"""Dane do Zasobnika wiedzy ze stron ROPS Kraków (moduł II, „Biblioteka i wiedza”).

Co pobiera:
1. Biblioteka Innowacji Społecznych: 9 kategorii → strony innowacji. Sekcje 1–5, odznaka upowszechniania,
   PDF-folder („dowiedz się więcej”), film na YouTube, paczka ZIP z materiałami (z rozmiarem — bywa
   kilka GB, więc UI musi go pokazać przed pobraniem), licencja.
   Sekcję „Autorzy” pomijamy — to dane osobowe (wymóg ROPS).
   PDF-folderów nie parsujemy: mają układ kolumnowy i sekcje mieszają się w tekście — zostaje sam link.
2. Filmy: tytuł i miniatura z YouTube oEmbed — przy okazji sprawdzamy, że film nadal istnieje.
3. Raporty z badań ROPS: tytuł, rok, opis, link, typ i rozmiar pliku.
4. Publikacje ze świata innowacji (w tym „Połącz kropki” i Social Canvas INNO AGH).
5. Mapa Wyzwań Społecznych (PDF): 8 obszarów — definicja, analiza danych, kluczowe wyzwania, persona,
   raporty do poczytania. Dane w mapie są OGÓLNOPOLSKIE.

Strona odpowiada na zwykłe żądania HTTP (Playwright niepotrzebny). Każdy URL pobieramy raz
(cache w raw/knowledge/), z przerwą 1,5–2,5 s. Ponowne uruchomienie korzysta z cache.

    cd data && uv run scrape_knowledge.py
Wynik: out/knowledge/{innovations,reports,publications,challenge_map}.json"""
import hashlib
import html
import json
import random
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

from common import OUT, RAW, write_json

SITE = "https://rops.krakow.pl"
LIBRARY = f"{SITE}/innowacje-spoleczne/biblioteka-innowacji-spolecznych/"
REPORTS = f"{SITE}/badania-analizy-raporty/raporty-z-badan"
PUBLICATIONS = f"{SITE}/innowacje-spoleczne/publikacje-ze-swiata-innowacji"
CHALLENGE_MAP = f"{SITE}/mpliki/IS/IWS_20/za._nr_2._Mapa_Wyzwa_Spoecznych.pdf"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

CACHE = RAW / "knowledge"
DEST = OUT / "knowledge"

# slug kategorii w URL-u → klucz osi 2 (GROUPS w lib/schemas.ts)
CATEGORIES = {
    "dla-seniorow": "seniorzy",
    "dla-dzieci-mlodziezy-i-rodziny": "dzieci_mlodziez_rodzina",
    "dla-osob-o-ograniczonej-mobilnosci": "ograniczona_mobilnosc",
    "dla-osob-z-niepelnosprawnoscia-sensoryczna": "niepelnosprawnosc_sensoryczna",
    "dla-zdrowia-i-medycyny": "zdrowie_medycyna",
    "dla-rynku-pracy": "rynek_pracy",
    "dla-cudzoziemcow": "cudzoziemcy",
    "dla-osob-w-kryzysie-bezdomnosci": "bezdomnosc",
    "dla-osob-z-niepelnosprawnoscia-intelektualna": "niepelnosprawnosc_intelektualna",
}

# Numer sekcji na stronie → pole w innovations. Nagłówki bywają różnie sformułowane, numer jest stały.
SECTIONS = {"1": "solution", "2": "problem", "3": "beneficiaries", "4": "who_can_use", "5": "evidence"}

# Kolejność i klucze obszarów jak MWS_AREAS w lib/schemas.ts
AREAS = [
    ("rodzina_piecza", "Rodzina i piecza zastępcza"),
    ("bezdomnosc", "Bezdomność"),
    ("niepelnosprawnosc", "Niepełnosprawność"),
    ("ubostwo", "Ubóstwo"),
    ("cudzoziemcy", "Integracja cudzoziemców"),
    ("zdrowie", "Zdrowie"),
    ("zdrowie_psychiczne", "Zdrowie psychiczne"),
    ("seniorzy", "Seniorzy"),
]


# ── Pobieranie ──────────────────────────────────────────────

def _cache_path(url: str, ext: str):
    return CACHE / f"{hashlib.sha1(url.encode()).hexdigest()[:16]}{ext}"


def fetch(url: str, ext: str = ".html") -> bytes:
    path = _cache_path(url, ext)
    if path.exists():
        return path.read_bytes()
    time.sleep(random.uniform(1.5, 2.5))
    req = urllib.request.Request(urllib.parse.quote(url, safe=":/?=&,%#"), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return data


def fetch_html(url: str) -> str:
    return fetch(url).decode("utf-8", errors="replace")


def head(url: str) -> dict:
    """Typ i rozmiar pliku bez pobierania całości (cache jak dla stron)."""
    path = _cache_path(url, ".head.json")
    if path.exists():
        return json.loads(path.read_text())
    time.sleep(random.uniform(1.5, 2.5))
    req = urllib.request.Request(urllib.parse.quote(url, safe=":/?=&,%#"), method="HEAD", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            info = {"status": r.status, "content_type": r.headers.get("Content-Type"),
                    "size_bytes": int(r.headers.get("Content-Length") or 0) or None}
    except Exception as e:  # noqa: BLE001 — martwy link zapisujemy, nie przerywamy
        info = {"status": getattr(e, "code", None), "content_type": None, "size_bytes": None}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(info))
    return info


# ── Pomocnicze ──────────────────────────────────────────────

def text(fragment: str) -> str:
    """HTML → zwykły tekst: akapity jako nowe linie, encje zdekodowane, spacje znormalizowane."""
    s = re.sub(r"<br\s*/?>|</p>|</li>", "\n", fragment, flags=re.I)
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    lines = [re.sub(r"[ \t ​]+", " ", ln).strip() for ln in s.splitlines()]
    return "\n".join(ln for ln in lines if ln)


def absolute(href: str) -> str:
    return urllib.parse.urljoin(SITE + "/", html.unescape(href.strip()))


def content_block(page: str) -> str:
    """Główna treść strony ROPS: od tytułu do przycisków Powrót/Drukuj (albo bloku Publikacje)."""
    start = page.find('class="page-title"')
    if start < 0:
        return ""
    end = min([i for i in (page.find("btns-holder", start), page.find("m-publications", start)) if i > 0] or [len(page)])
    return page[start:end]


def youtube_id(url: str) -> str | None:
    m = re.search(r"(?:v=|youtu\.be/|embed/)([\w-]{11})", url)
    return m.group(1) if m else None


def oembed(video_id: str) -> dict | None:
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    try:
        return json.loads(fetch(url, ".json"))
    except Exception:  # noqa: BLE001 — film usunięty albo prywatny
        return None


# ── 1–2. Biblioteka Innowacji Społecznych ───────────────────

def category_links() -> dict[str, dict]:
    """slug innowacji → {url, groups}. Ta sama innowacja bywa w kilku kategoriach; URL bierzemy z pierwszej."""
    out: dict[str, dict] = {}
    for cat, group in CATEGORIES.items():
        page = fetch_html(LIBRARY + cat)
        for slug in dict.fromkeys(re.findall(rf'href="[^"]*/{cat},([^"/?#]+)"', page)):
            entry = out.setdefault(slug, {"url": f"{LIBRARY}{cat},{slug}", "groups": []})
            if group not in entry["groups"]:
                entry["groups"].append(group)
    return out


def parse_innovation(url: str, groups: list[str]) -> dict:
    block = content_block(fetch_html(url))
    title = text(re.search(r'class="page-title">(.*?)</h2>', block, re.S).group(1))
    body = block[block.find('class="text-content"'):]

    badge = None
    m = re.search(r"<strong>([^<]*UPOWSZECHNIANI[^<]*)</strong>", body, re.I)
    if m:
        badge = text(m.group(1))

    # Sekcje po <h4>: „1. Na czym polega rozwiązanie?” … „5. Czy to działa?”. „6. Autorzy” pomijamy.
    fields: dict[str, str | None] = {f: None for f in SECTIONS.values()}
    headings: dict[str, str] = {}
    parts = re.split(r"<h[3-5][^>]*>(.*?)</h[3-5]>", body, flags=re.S)
    for heading, content in zip(parts[1::2], parts[2::2]):
        h = text(heading)
        num = re.match(r"\s*(\d+)\s*\.", h)
        if num and num.group(1) in SECTIONS:
            fields[SECTIONS[num.group(1)]] = text(re.sub(r"<table.*?</table>", "", content, flags=re.S)) or None
            headings[SECTIONS[num.group(1)]] = h

    links = [absolute(h) for h in re.findall(r'<a[^>]+href="([^"]+)"', body)]
    pdf = next((h for h in links if h.lower().split("?")[0].endswith(".pdf")), None)
    zip_ = next((h for h in links if h.lower().split("?")[0].endswith(".zip")), None)
    video = next((h for h in links if youtube_id(h) and "youtu" in h), None)
    license_ = next((h for h in links if "creativecommons.org" in h), None)
    qr = next((absolute(s) for s in re.findall(r'<img[^>]+src="([^"]+)"', body)
               if "BIBLIOTEKA_INNOWACJI" in s and s.lower().endswith((".png", ".jpg"))), None)

    return {
        "slug": url.rsplit(",", 1)[1],
        "source_url": url,
        "title": title,
        "groups": groups,
        "dissemination_badge": badge,
        **fields,
        "section_headings": headings,
        "pdf_url": pdf,
        "materials_zip_url": zip_,
        "video_url": video,
        "license_url": license_,
        "qr_image_url": qr,
    }


def library() -> list[dict]:
    links = category_links()
    items = []
    for i, (slug, entry) in enumerate(links.items(), 1):
        print(f"[{i}/{len(links)}] {slug}", file=sys.stderr)
        item = parse_innovation(entry["url"], entry["groups"])
        vid = youtube_id(item["video_url"] or "")
        meta = oembed(vid) if vid else None
        item["video"] = ({"youtube_id": vid, "title": meta["title"], "channel": meta.get("author_name"),
                          "thumbnail_url": meta.get("thumbnail_url")} if meta else None)
        if item["materials_zip_url"]:
            h = head(item["materials_zip_url"])
            item["materials_zip"] = {"url": item["materials_zip_url"], "size_bytes": h["size_bytes"], "link_ok": h["status"] == 200}
        else:
            item["materials_zip"] = None
        del item["materials_zip_url"]
        items.append(item)
    return items


# ── 3. Raporty z badań ──────────────────────────────────────

def parse_size(s: str) -> int | None:
    m = re.match(r"([\d.,]+)\s*(kB|MB|GB|B)", s.strip(), re.I)
    if not m:
        return None
    mult = {"b": 1, "kb": 1000, "mb": 1000**2, "gb": 1000**3}[m.group(2).lower()]
    return round(float(m.group(1).replace(",", ".")) * mult)


def reports() -> list[dict]:
    block = content_block(fetch_html(REPORTS))
    out = []
    for li in re.findall(r'<li class="files__item">(.*?)</li>', block, re.S):
        a = re.search(r'<a href="([^"]+)"[^>]*>(.*?)</a>', li, re.S)
        desc = re.search(r'<p class="files__desc">(.*?)</p>', li, re.S)
        typ = re.search(r"Typ: <strong>(.*?)</strong>", li)
        size = re.search(r"Rozmiar: <strong>(.*?)</strong>", li)
        title = text(a.group(2))
        year = re.match(r"\s*(\d{4})", title)
        out.append({
            "title": re.sub(r"^\s*\d{4}\s*[|I]\s*", "", title),
            "year": int(year.group(1)) if year else None,
            "description": text(desc.group(1)) if desc else None,
            "url": absolute(a.group(1)),
            "format": text(typ.group(1)) if typ else None,
            "size_bytes": parse_size(size.group(1)) if size else None,
            "language": "pl",
            "source_page": REPORTS,
        })
    return out


# ── 4. Publikacje ze świata innowacji ───────────────────────

def publications() -> list[dict]:
    page = fetch_html(PUBLICATIONS)
    block = content_block(page)
    out = []
    # Tabele: okładka, link „pobierz”, opis (<strong>tytuł</strong>, zajawka, „rok wydania: …”)
    for table in re.findall(r"<table.*?</table>", block, re.S):
        a = re.search(r'<a href="([^"]+\.pdf)"', table, re.I)
        if not a:
            continue
        cells = re.findall(r"<td[^>]*>(.*?)</td>", table, re.S)
        info = text(next((c for c in cells if "<strong>" in c), table))
        lines = [ln.strip('"„” ') for ln in info.splitlines() if ln.strip('"„” ')]
        year = re.search(r"(?:rok wydania|Year of publication):\s*(\d{4})", info, re.I)
        title = lines[0] if lines else None
        desc = " ".join(ln for ln in lines[1:] if not re.match(r"(rok wydania|Year of publication)", ln, re.I)) or None
        url = absolute(a.group(1))
        out.append({"title": title, "description": desc, "year": int(year.group(1)) if year else None,
                    "url": url, "language": "en" if "_ENG" in url else "pl"})
    for item in re.findall(r'news-list__item">(.*?)</div>\s*</div>', block, re.S):
        if any(o["url"] in item for o in out):
            continue
        pdf = re.search(r'href="([^"]+\.pdf)"', item, re.I)
        if pdf and not any(o["url"] == absolute(pdf.group(1)) for o in out):
            out.append({"title": text(re.search(r'news-list__title">(.*?)</', item, re.S).group(1)),
                        "description": None, "year": None, "url": absolute(pdf.group(1)), "language": "pl"})
    for o in out:
        h = head(o["url"])
        o.update(format="PDF" if (h["content_type"] or "").endswith("pdf") else h["content_type"],
                 size_bytes=h["size_bytes"], link_ok=h["status"] == 200, source_page=PUBLICATIONS)
    # Guide to social innovations jest w dwóch miejscach strony — zostawiamy jeden wpis
    seen, unique = set(), []
    for o in out:
        if o["url"] not in seen:
            seen.add(o["url"])
            unique.append(o)
    return unique


# ── 5. Mapa Wyzwań Społecznych ──────────────────────────────

SECTION_NAMES = ["Definicja obszaru", "Analiza danych zastanych", "Kluczowe wyzwania", "PERSONA", "Dowiedz się więcej!"]


def bullets(chunk: str) -> list[str]:
    """Punkty „• …” sklejone z łamanych linii; tekst bez punktów → akapity."""
    chunk = re.sub(r"\n(?=[a-ząćęłńóśźż(,–-])", " ", chunk)  # zawinięte linie zaczynają się małą literą
    chunk = re.sub(r"\n## ", "\n• ## ", chunk)  # podtytuły („## osoby dorosłe”) jako osobne pozycje
    items = [re.sub(r"\s+", " ", b).strip(" •") for b in re.split(r"\n?\s*•\s*", chunk)]
    return [b for b in items if b]


def challenge_map() -> dict:
    fetch(CHALLENGE_MAP, ".pdf")
    path = _cache_path(CHALLENGE_MAP, ".pdf")
    txt = path.with_suffix(".map.txt")
    if not txt.exists():
        subprocess.run(["pdftotext", str(path), str(txt)], check=True)
    raw = txt.read_text(encoding="utf-8")

    # Slajdy zaczynają się od „N. Nazwa obszaru” (czasem „7.Zdrowie”, złamane w kilku liniach),
    # potem nazwa sekcji, czasem z dopiskiem: „Analiza danych zastanych (osoby dorosłe)”.
    lines = [ln.strip() for ln in raw.replace("\f", "\n").splitlines()]
    blocks: dict[str, dict[str, list[str]]] = {key: {} for key, _ in AREAS}
    area: str | None = None
    current: list[str] | None = None
    for ln in lines:
        m = re.fullmatch(r"(\d)\.\s*(\S.*)", ln)
        if m and 1 <= int(m.group(1)) <= len(AREAS) and AREAS[int(m.group(1)) - 1][1].startswith(m.group(2)):
            area, current = AREAS[int(m.group(1)) - 1][0], None
            continue
        section = next((name for name in SECTION_NAMES if ln.startswith(name)), None)
        if area and section:
            current = blocks[area].setdefault(section, [])
            suffix = ln[len(section):].strip()
            if suffix:
                current.append(f"## {suffix.strip('()')}")
            continue
        if current is not None:
            current.append(ln)

    def split_sources(s: str) -> tuple[str, list[str]]:
        """Linie po „Źródła:” to źródła — do następnego punktu „•”, po którym wraca treść."""
        body, sources, in_sources = [], [], False
        for ln in s.splitlines():
            if ln.startswith("Źródła:") or ln.startswith("Źródło:"):
                in_sources = True
                rest = ln.split(":", 1)[1].strip()
                if rest:
                    sources.append(rest)
                continue
            if in_sources and ln.startswith("•"):
                in_sources = False
            (sources if in_sources else body).append(ln)
        return "\n".join(body), [x for x in sources if x]

    areas = {}
    for key, label in AREAS:
        sections = {name: "\n".join(body).strip() for name, body in blocks[key].items()}
        definition, def_sources = split_sources(sections.get("Definicja obszaru", ""))
        analysis, an_sources = split_sources(sections.get("Analiza danych zastanych", ""))
        challenges, ch_sources = split_sources(sections.get("Kluczowe wyzwania", ""))
        more = sections.get("Dowiedz się więcej!", "")
        reading = [re.sub(r"\s+", " ", m).strip() for m in re.findall(r"Strona tytułowa raportu:\s*(.*?)(?=\nStrona tytułowa raportu:|\n\n|\Z)", more, re.S)]

        # Definicja: akapity prozą (punkty, jeśli są, idą do analizy — tak bywa w PDF-ie)
        def_paras = bullets(definition)
        areas[key] = {
            "label": label,
            "definition": def_paras[0] if def_paras else None,
            "definition_more": def_paras[1:],
            "analysis": bullets(analysis),
            "challenges": bullets(challenges),
            "persona_raw": sections.get("PERSONA") or None,
            "raw_sections": sections,
            "further_reading": reading,
            "sources": def_sources + an_sources + ch_sources,
        }
    return {
        "source": {"title": "Mapa Wyzwań Społecznych", "publisher": "Regionalny Ośrodek Polityki Społecznej w Krakowie",
                   "url": CHALLENGE_MAP, "scope_note": "Dane zawarte w „Mapie wyzwań społecznych” są danymi ogólnopolskimi."},
        "areas": areas,
    }


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    write_json(DEST / "challenge_map.json", challenge_map())
    write_json(DEST / "reports.json", reports())
    write_json(DEST / "publications.json", publications())
    write_json(DEST / "innovations.json", library())
    print(f"Zapisano do {DEST}", file=sys.stderr)


if __name__ == "__main__":
    main()
