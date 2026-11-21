"""Wspólny format rekordów źródłowych Radaru (tabela source_records, 0008_source_records.sql).

Każdy importer (uprp.py, epo_ops.py, pbn.py, ncbr.py, interreg.py) zamienia dane źródła na listę słowników
z polami RECORD_FIELDS, przepuszcza je przez normalize() i zapisuje migawkę save_snapshot() w raw/sources/<źródło>.json.
Z migawek sources_seed.py robi ../supabase/seed/40_sources.sql.

Zasady wspólne dla wszystkich źródeł:
- tylko instytucje publiczne z regionu (is_regional_public): uczelnie publiczne, JST, szkoły, instytucje kultury i zdrowia;
- bez danych osobowych: pola z nazwiskami (twórcy, autorzy) są usuwane, a tytuły naukowe z nazwiskiem w tekście
  zamieniane na „[osoba]” (scrub_persons) — zostaje instytucja;
- migawka syntetyczna (gdy źródło nie ma otwartego API) ma synthetic = true i „(przykład)” w nazwie instytucji.
"""
import json
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # common.py z katalogu data/

from common import OUT, ROOT, read_json  # noqa: E402

SNAPSHOTS = ROOT / "raw" / "sources"
DOWNLOADS = SNAPSHOTS / "download"   # surowe pliki ze źródeł — dane niezaufane, poza repo
USER_AGENT = "radar-innowacji-pipeline/0.1 (hackathon prototype)"

SOURCES = ("uprp", "epo", "pbn", "ncbr", "interreg")
KINDS = ("zgloszenie_patentowe", "patent", "publikacja", "projekt")
RECORD_FIELDS = ("source", "external_id", "kind", "title", "abstract", "institution", "institution_type", "teryt",
                 "published_on", "url", "license", "keywords", "synthetic")

# Pola, w których źródła trzymają osoby — nigdy nie trafiają do migawki.
PERSON_FIELDS = ("inventors", "inventor", "authors", "author", "contributors", "creators", "contact", "contact_person",
                 "email", "phone")

# ── Instytucje publiczne regionu ──
# Uczelnie publiczne Podkarpacia (nazwy pełne i skróty, pod które źródła je zapisują) → miasto siedziby.
PUBLIC_UNIVERSITIES = {
    "Politechnika Rzeszowska": ("Rzeszów", [r"politechnik\w* rzeszowsk", r"rzeszow university of technology", r"\bprz\b"]),
    "Uniwersytet Rzeszowski": ("Rzeszów", [r"uniwersytet\w* rzeszowsk", r"university of rzesz[oó]w"]),
    "Państwowa Akademia Nauk Stosowanych w Przemyślu": ("Przemyśl", [r"akademi\w* nauk stosowanych w przemy", r"pans w przemy", r"przemy\w* .*state"]),
    "Państwowa Akademia Nauk Stosowanych w Krośnie": ("Krosno", [r"akademi\w* nauk stosowanych w kro", r"pans w kro", r"karpacka pa[nń]stwowa uczelnia"]),
    "Państwowa Akademia Nauk Stosowanych w Jarosławiu": ("Jarosław", [r"akademi\w* nauk stosowanych .*jaros", r"pwste", r"applied sciences in jaros"]),
    "Akademia Nauk Stosowanych w Sanoku": ("Sanok", [r"nauk stosowanych w sanoku", r"uczelnia pa[nń]stwowa im\. jana grodka"]),
    "Akademia Nauk Stosowanych w Tarnobrzegu": ("Tarnobrzeg", [r"nauk stosowanych w tarnobrzegu", r"akademia tarnobrzeska"]),
}

# Typ instytucji (config/taxonomy.json → institutionTypes) z nazwy; kolejność ma znaczenie (pierwsze trafienie).
INSTITUTION_PATTERNS = [
    ("pomoc_zdrowie", r"szpital|hospital|o[sś]rodek pomocy|centrum us[lł]ug spo[lł]ecznych|pcpr|centrum pomocy rodzinie|przychodni"),
    ("uczelnia", r"uniwersytet|politechnik|akademi\w* nauk|uczelni|instytut badawcz|university"),
    ("szkola_ponadpodstawowa", r"technikum|liceum|zesp[oó]ł szk[oó]ł|szko[lł]\w* bran[zż]owa|centrum kształcenia"),
    ("szkola_podstawowa", r"szko[lł]\w* podstawow|przedszkol"),
    ("kultura", r"muzeum|museum|bibliotek|library|dom kultury|o[sś]rodek kultury|centrum kultury|filharmoni|teatr"),
    ("gmina", r"\bgmin\w*|\bmiasto\b|urz[aą]d miasta|urz[aą]d gminy|municipality|commune|\bcity of\b"),
    ("powiat", r"\bpowiat\w*|starostw|wojew[oó]dztw\w*|urz[aą]d marsza[lł]kowski|county|voivodeship"),
    ("inna", r"park narodowy|nadle[sś]nictw|urz[aą]d pracy|stra[zż]|regionalna dyrekcja|agencja|zarz[aą]d dr[oó]g|euroregion"),
]
# Podmioty prywatne i organizacje pozarządowe — poza zakresem Radaru (instytucje publiczne).
NON_PUBLIC = re.compile(
    r"sp\.? ?z ?o\.? ?o|s\.a\.|\bspółk|fundacj|foundation|stowarzyszeni|association|\bsp\. k\.|przedsi[eę]biorstw|izba|zwi[aą]zek|ltd",
    re.I)


def institution_type(name: str | None) -> str | None:
    n = (name or "").lower()
    return next((key for key, pattern in INSTITUTION_PATTERNS if re.search(pattern, n)), None)


def known_university(name: str | None) -> str | None:
    """Pełna nazwa uczelni publicznej regionu albo None."""
    n = (name or "").lower()
    return next((full for full, (_, patterns) in PUBLIC_UNIVERSITIES.items() if any(re.search(p, n) for p in patterns)), None)


def is_regional_public(name: str | None, teryt: str | None, prefix: str) -> bool:
    """Instytucja publiczna z regionu: znana uczelnia publiczna albo podmiot publiczny z TERYT regionu."""
    if not name or NON_PUBLIC.search(name):
        return False
    if known_university(name):
        return True
    return bool(teryt and teryt.startswith(prefix) and institution_type(name))


# ── Dane osobowe ──
TITLES = r"(?:prof\.|dr\.?|hab\.|inż\.|mgr|lek\.|in[zż]ynier|doktor|profesor)"
_NAME = r"[A-ZŁŚŻŹĆŃÓ][a-ząćęłńóśźż]+(?:-[A-ZŁŚŻŹĆŃÓ][a-ząćęłńóśźż]+)?"
PERSON_IN_TEXT = re.compile(rf"(?:{TITLES}\s+)+{_NAME}(?:\s+{_NAME})?")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"(?<!\d)(?:\+48[ -]?)?\d{3}[ -]?\d{3}[ -]?\d{3}(?!\d)")


def scrub_persons(text: str | None) -> str | None:
    """Osoba z tytułem („dr hab. inż. Jan Kowalski”), e-mail i telefon → „[osoba]”, „[e-mail]”, „[telefon]”."""
    if text is None:
        return None
    text = PERSON_IN_TEXT.sub("[osoba]", text)
    text = EMAIL.sub("[e-mail]", text)
    return PHONE.sub("[telefon]", text)


# ── Gminy regionu (TERYT) ──
_GMINY: list[dict] | None = None


def gminy() -> list[dict]:
    global _GMINY
    if _GMINY is None:
        _GMINY = read_json(OUT / "gminy.json")
    return _GMINY


def teryt_for(gmina: str | None, powiat: str | None = None, city: str | None = None, rural: bool | None = None) -> str | None:
    """TERYT gminy po nazwie (i powiecie). Ta sama nazwa dla miasta i gminy wiejskiej (Sanok): rural rozstrzyga,
    a bez niego miasto, gdy siedziba jest w mieście."""
    if not gmina:
        return None
    norm = lambda s: re.sub(r"^m\.\s*|^miasto\s+", "", (s or "").strip().lower())  # noqa: E731
    hits = [g for g in gminy() if norm(g["nazwa"]) == norm(gmina)]
    if powiat and len(hits) > 1:
        same = [g for g in hits if norm(g["powiat"]) == norm(powiat)]
        hits = same or hits
    if len(hits) > 1:
        urban = not rural if rural is not None else (city is None or norm(city) == norm(gmina))
        hits.sort(key=lambda g: (g["typ"] != "miejska") if urban else (g["typ"] == "miejska"))
    return hits[0]["teryt"] if hits else None


def city_teryt(city: str) -> str | None:
    return teryt_for(city, city=city)


def rural_by_name(name: str) -> bool | None:
    """„Gmina Sanok” to gmina wiejska, „Miasto Sanok” / „Gmina Miejska Sanok” — miasto; inne nazwy nic nie mówią."""
    n = name.lower()
    if n.startswith("gmina ") and "miejsk" not in n:
        return True
    if n.startswith(("miasto ", "gmina miejska ", "urząd miasta ")):
        return False
    return None


# ── Rekord ──

def normalize(raw: dict) -> dict:
    """Rekord we wspólnym formacie: tylko RECORD_FIELDS, bez pól z osobami, z oczyszczonym tekstem."""
    for f in PERSON_FIELDS:
        raw.pop(f, None)
    if raw.get("source") not in SOURCES:
        raise ValueError(f"Nieznane źródło: {raw.get('source')}")
    if raw.get("kind") not in KINDS:
        raise ValueError(f"Nieznany rodzaj rekordu: {raw.get('kind')}")
    if not raw.get("external_id") or not raw.get("title") or not raw.get("license"):
        raise ValueError(f"Rekord bez identyfikatora, tytułu albo licencji: {raw}")
    university = known_university(raw.get("institution"))
    institution = university or (raw.get("institution") or "").strip() or None
    if raw.get("synthetic") and institution and "(przykład)" not in institution:
        institution = f"{institution} (przykład)"
    published = raw.get("published_on")
    if isinstance(published, (date, datetime)):
        published = published.strftime("%Y-%m-%d")
    elif isinstance(published, str):
        published = published[:10]
    teryt = (raw.get("teryt") or (city_teryt(raw["city"]) if raw.get("city") else None)
             or (city_teryt(PUBLIC_UNIVERSITIES[university][0]) if university else None))
    return {
        "source": raw["source"],
        "external_id": str(raw["external_id"]).strip(),
        "kind": raw["kind"],
        "title": scrub_persons(re.sub(r"\s+", " ", raw["title"]).strip()),
        "abstract": scrub_persons(re.sub(r"\s+", " ", raw.get("abstract") or "").strip() or None),
        "institution": institution,
        "institution_type": raw.get("institution_type") or institution_type(institution),
        "teryt": teryt,
        "published_on": published or None,
        "url": raw.get("url"),
        "license": raw["license"],
        "keywords": [k.strip().lower() for k in raw.get("keywords", []) if k and k.strip()][:12],
        "synthetic": bool(raw.get("synthetic")),
    }


def save_snapshot(source: str, records: list[dict], *, real: bool, note: str, license: str) -> Path:
    """Migawka źródła: posortowana, żeby diff w repo pokazywał tylko prawdziwe zmiany."""
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    path = SNAPSHOTS / f"{source}.json"
    body = {
        "source": source,
        "real": real,
        "license": license,
        "note": note,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "records": sorted(records, key=lambda r: r["external_id"]),
    }
    path.write_text(json.dumps(body, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{path.relative_to(ROOT)}: {len(records)} rekordów ({'prawdziwe' if real else 'syntetyczne'})")
    return path


def load_snapshots() -> list[dict]:
    out = []
    for source in SOURCES:
        path = SNAPSHOTS / f"{source}.json"
        if path.exists():
            out.extend(json.loads(path.read_text(encoding="utf-8"))["records"])
    return out


SYNTHETIC_LICENSE = "Dane przykładowe (syntetyczne) — nie pochodzą ze źródła, służą do demonstracji."


def save_synthetic(source: str, records: list[dict], why: str) -> Path:
    """Migawka przykładowa dla źródła bez otwartego dostępu: każdy rekord synthetic = true, instytucja ogólna z „(przykład)”."""
    # Zmyślony patent czy publikacja nie może nosić nazwy prawdziwej instytucji, nawet z „(przykład)”.
    real = [r["institution"] for r in records if known_university(r.get("institution"))]
    if real:
        raise ValueError(f"Rekord przykładowy z nazwą prawdziwej instytucji: {real}. Użyj nazwy ogólnej i pola city.")
    rows = [normalize({**r, "source": source, "license": SYNTHETIC_LICENSE, "synthetic": True}) for r in records]
    return save_snapshot(source, rows, real=False, license=SYNTHETIC_LICENSE,
                         note=f"Migawka przykładowa. {why} Identyfikatory zaczynają się od PRZYKLAD-, żeby nie udawały prawdziwych.")
