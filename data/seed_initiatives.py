"""Dane demo Radaru — WYRAŹNIE OZNACZONE jako syntetyczne (synthetic = true, „(przykład)” w nazwach).

Z archetypów w templates/initiatives.json losuje ~130 inicjatyw rozłożonych po gminach regionu według
reguł place i profili BDL (seniorzy częściej tam, gdzie dużo osób 65+, wyludnianie tam, gdzie ludności ubywa).
Ten sam archetyp w kilku gminach to celowo „podobne inicjatywy” — potencjalni partnerzy. Pierwsza
działająca kopia archetypu jest źródłem, a część późniejszych to jej adopcje („Wypróbowaliśmy u nas”).

Ocena radaru: baza z archetypu, szum ±1 i te same reguły oraz wagi dla typu innowacji co lib/radar/score.ts
(config/taxonomy.json → radar). Bez nazw prawdziwych instytucji: tylko typ instytucji i gmina.
Nie wywołuje żadnego API. Stałe ziarno i slugi → ten sam wynik przy każdym uruchomieniu.

Model innowacji PCI (Radar 4/10): każda inicjatywa ma typ innowacji, sektory PCI, a technologiczna też TRL zgodny
z etapem kopii i status ochrony IP. Inicjatywy należą do syntetycznych instytucji (typ + gmina, bez nazw własnych),
twórcy to role bez imion i kontaktu, a partnerzy (firmy, fundusze, CTT, PCI, samorządy) idą z templates → partners.

Wejście: out/gminy.json (bdl.py), templates/initiatives.json, forms/program_demo.json.
Wynik: ../supabase/seed/30_demo.sql (supabase db reset / load.py) i out/demo.json (tryb bez bazy: Panel → Trendy).

    cd data && uv run seed_initiatives.py"""
import random
import re
import sys
import uuid
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

from common import (CREATOR_ROLES, CROSS, DOMAINS, INNOVATION_KINDS, INSTITUTION_TYPES, IP_STATUSES, OUT, PARTNER_KINDS,
                    PARTNER_SUPPORT, RADAR, ROOT, SECTORS, SEED, STAGES, TRL_STAGE, Jsonb, check_keys, index_row, read_json,
                    lit, upsert, write_json)
from region import STATUS_PREFIX

RNG_SEED = 2026
TODAY = date(2026, 11, 15)
COPIES = (2, 5)                                         # ile gmin na archetyp (min, max)
ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"           # jak lib/status-code.ts
NS = uuid.UUID("0b7d3f0e-6a51-4a0c-9d43-3f4a2c1e9b70")  # stałe UUID-y → idempotentny seed

TEMPLATES = read_json(ROOT / "templates" / "initiatives.json")
PLACES = TEMPLATES["places"]

# Statusy opublikowanych i czekających na Panel (published = false) — losowane z wagami.
PUBLISHED_STATUS = {"featured": 3, "supported": 3, "scaling": 2, "in_review": 1}
PRIVATE_STATUS = {"submitted": 3, "in_review": 2}

INSTITUTION_NAME = {  # adopter_org i podpisy: typ instytucji + gmina, nigdy nazwa własna
    "szkola_podstawowa": "Szkoła podstawowa", "szkola_ponadpodstawowa": "Szkoła ponadpodstawowa",
    "uczelnia": "Uczelnia", "gmina": "Urząd gminy", "powiat": "Starostwo powiatowe",
    "kultura": "Dom kultury", "pomoc_zdrowie": "Ośrodek pomocy społecznej", "inna": "Instytucja publiczna",
}

ADOPTION_FEEDBACK = [
    ("Gotowy opis i rozmowa z autorem oszczędziły nam pół roku.", "Przydałby się wzór budżetu na pierwszy rok."),
    ("Mieszkańcy szybko się włączyli, bo znali pomysł z sąsiedniej gminy.", "Trzeba wcześniej znaleźć osobę do koordynacji."),
    ("Działa także w mniejszej skali, wystarczył jeden zespół.", "Lepiej zacząć od jednej miejscowości niż od całej gminy."),
    ("Udało się bez dodatkowych etatów.", "Warto od początku zbierać dane o efektach."),
    ("Partner z regionu odpowiadał na pytania na bieżąco.", "Zabrakło materiałów dla osób starszych w prostym języku."),
]

# „Szukam rozwiązania”: instytucje opisują problem. gap = częściej zostaje bez dobrego dopasowania.
CHALLENGES = [
    dict(text="Szukamy sposobu, żeby uczniowie z dalekich wsi mogli zostać na zajęciach po lekcjach, bo ostatni autobus odjeżdża o 14.",
         domains=["edukacja", "mobilnosc"], institution="szkola_podstawowa", place="rural",
         keywords=["dowóz", "zajęcia pozalekcyjne", "uczeń", "wieś", "autobus szkolny"]),
    dict(text="Urząd chce skrócić kolejki do wydziału komunikacji i lepiej obsługiwać seniorów, którzy nie korzystają z internetu.",
         domains=["administracja", "cyfryzacja"], institution="gmina", place="town",
         keywords=["obsługa mieszkańca", "kolejka", "senior", "e-usługa", "urząd"]),
    dict(text="Nauczyciele w małej szkole nie umieją prowadzić lekcji z nowym sprzętem, który dostaliśmy w programie rządowym.",
         domains=["edukacja", "cyfryzacja"], institution="szkola_podstawowa", place="rural",
         keywords=["nauczyciel", "kompetencje cyfrowe", "sprzęt", "szkolenie", "lekcja"]),
    dict(text="Gmina szuka sposobu na obniżenie rachunków za prąd w szkołach i świetlicach.",
         domains=["srodowisko"], institution="gmina", place="any",
         keywords=["energia", "fotowoltaika", "oszczędność", "budynek publiczny", "rachunek"]),
    dict(text="Młodzi wyjeżdżają po studiach, a lokalne firmy nie mogą znaleźć pracowników. Szukamy, jak ich zatrzymać.",
         domains=["gospodarka", "edukacja"], institution="powiat", place="town",
         keywords=["młodzież", "praca", "odpływ młodych", "pracodawca", "staż"]),
    dict(text="Biblioteka pustoszeje, przychodzą tylko seniorzy. Chcemy przyciągnąć nastolatków.",
         domains=["kultura", "edukacja"], institution="kultura", place="town",
         keywords=["biblioteka", "młodzież", "czas wolny", "nastolatek", "oferta kulturalna"]),
    dict(text="Po zamknięciu przychodni mieszkańcy przysiółków nie mają jak dojechać do lekarza.",
         domains=["zdrowie", "mobilnosc"], institution="gmina", place="rural",
         keywords=["dojazd", "lekarz", "transport", "przychodnia", "wieś"]),
    dict(text="Szkoła ma coraz więcej uczniów z Ukrainy, którzy słabo mówią po polsku i trzymają się osobno.",
         domains=["edukacja", "uslugi_spoleczne"], institution="szkola_podstawowa", place="border",
         keywords=["uczeń z Ukrainy", "integracja", "język polski", "szkoła", "cudzoziemiec"]),
    dict(text="Rolnicy z naszej gminy sprzedają płody hurtownikom za grosze. Szukamy sposobu na sprzedaż bezpośrednią.",
         domains=["gospodarka"], institution="gmina", place="rural",
         keywords=["rolnik", "sprzedaż bezpośrednia", "lokalny produkt", "targ", "rolnictwo"]),
    dict(text="Uczelnia ma wyniki badań, które mogłyby pomóc gminom, ale nikt z samorządu o nie nie pyta.",
         domains=["nauka", "administracja"], institution="uczelnia", place="university",
         keywords=["transfer wiedzy", "badanie", "samorząd", "uczelnia", "współpraca"]),
    dict(text="Mamy dużo pustostanów w centrum miasteczka. Szukamy pomysłów, jak je ożywić z mieszkańcami.",
         domains=["partycypacja", "gospodarka"], institution="gmina", place="town", gap=True,
         keywords=["pustostan", "rewitalizacja", "centrum", "mieszkaniec", "lokal"]),
    dict(text="Szukamy sposobu na opiekę nad dziećmi w wakacje dla rodziców pracujących na zmiany w zakładach.",
         domains=["edukacja", "uslugi_spoleczne"], institution="gmina", place="town", gap=True,
         keywords=["opieka nad dzieckiem", "wakacje", "praca zmianowa", "rodzic", "półkolonie"]),
    dict(text="Park narodowy chce ograniczyć ruch samochodów w szczycie sezonu, a turyści nie chcą korzystać z busów.",
         domains=["mobilnosc", "srodowisko"], institution="inna", place="border", gap=True,
         keywords=["turystyka", "ruch samochodowy", "bus", "parking", "góry"]),
    dict(text="Strażacy ochotnicy się starzeją, młodzi nie chcą wstępować do OSP.",
         domains=["partycypacja"], institution="gmina", place="rural", gap=True,
         keywords=["straż pożarna", "OSP", "młodzież", "wolontariat", "bezpieczeństwo"]),
]
CHALLENGE_COUNT = 26


def uid(*parts: str) -> str:
    return str(uuid.uuid5(NS, "|".join(parts)))


def slugify(s: str) -> str:
    table = str.maketrans("ąćęłńóśźż", "acelnoszz")
    return re.sub(r"[^a-z0-9]+", "-", s.lower().translate(table)).strip("-")


def status_code(rng: random.Random, used: set[str]) -> str:
    while True:
        code = f"{STATUS_PREFIX}-" + "".join(rng.choice(ALPHABET) for _ in range(4))
        if code not in used:
            used.add(code)
            return code


def created_at(rng: random.Random, days_back: int, after: date | None = None) -> str:
    # Nowsze zgłoszenia częściej (potęga przesuwa masę ku dziś) — trend w Panelu rośnie.
    start = (TODAY - after).days if after else days_back
    ago = int(max(start - 1, 0) * (1 - rng.random() ** 0.7))
    dt = datetime.combine(TODAY - timedelta(days=ago), datetime.min.time(), timezone.utc)
    return (dt + timedelta(minutes=rng.randint(7 * 60, 20 * 60))).isoformat()


# ── Gminy dla reguł place ──

def candidates(place: str, gminy: list[dict]) -> list[dict]:
    by_name = {g["nazwa"]: g for g in gminy if g["typ"] == "miejska"}
    if isinstance(PLACES.get(place), dict) and place != "_opis":
        return [g for name, w in PLACES[place].items() for g in [by_name[name]] * w]
    if place == "rural":
        return [g for g in gminy if g["typ"] == "wiejska"]
    if place == "town":
        return [g for g in gminy if g["typ"] != "wiejska" and g["nazwa"] not in PLACES["city"]]
    if place == "border":
        return [g for g in gminy if g["powiat"] in PLACES["borderCounties"]]
    return gminy


def weight(g: dict, cross: list[str]) -> float:
    """Profil gminy z BDL zmienia, gdzie archetyp jest bardziej prawdopodobny."""
    w = (g["ludnosc"] or 3000) ** 0.4
    if "seniorzy" in cross:
        w *= max((g["udzial_65plus"] or 18) - 14, 1) / 4
    if "depopulacja" in cross:
        w *= 2.5 if (g["zmiana_ludnosci_10l"] or 0) < -3 else 0.5
    return w


def gmina_by_name(name: str, gminy: list[dict]) -> dict:
    """Siedziba partnera: przy dwóch gminach o tej samej nazwie (miejska i wiejska) bierzemy miejską."""
    hits = sorted((g for g in gminy if g["nazwa"] == name), key=lambda g: g["typ"] != "miejska")
    if not hits:
        sys.exit(f"Nieznana gmina partnera: {name}")
    return hits[0]


def trl_for(base: int, stage: str) -> int:
    """TRL kopii w przedziale jej etapu (config/taxonomy.json → trlStage); przeniesiona = co najmniej „działa”."""
    lo, hi = TRL_STAGE["dziala" if stage == "przeniesiona" else stage]
    return min(max(base, lo), hi)


def institution_for(a: dict, g: dict, institutions: dict[str, dict]) -> dict:
    """Instytucja = typ (albo institution_label) + gmina. Ta sama para w kilku archetypach to ta sama instytucja."""
    label = a.get("institution_label") or INSTITUTION_NAME[a["institution_type"]]
    name = f"{label}, {g['nazwa']} (przykład)" if a["institution_type"] != "uczelnia" else f"{label} publiczna, {g['nazwa']} (przykład)"
    slug = slugify(f"{label}-{g['nazwa']}-{g['teryt']}")
    if slug not in institutions:
        institutions[slug] = {"id": uid("institution", slug), "slug": slug, "name": name,
                              "institution_type": a["institution_type"], "teryt": g["teryt"]}
    return institutions[slug]


# ── Ocena radaru (te same zasady co lib/radar/score.ts) ──

def weights_key(kind: str | None) -> str:
    return kind if kind in RADAR["weights"] and kind != "domyslne" else "domyslne"


def assess(rng: random.Random, base: dict, stage: str, kind: str | None, trl: int | None) -> tuple[dict, int, list[str]]:
    """Ocena z archetypu + szum ±1, potem te same reguły co lib/radar/score.ts → applyRules (bez sprawdzania cytatów:
    seed nie ma cytatów, evidence = null). Zwraca wymiary, sygnał z wag dla typu i nazwę zestawu wag."""
    raw = {}
    for key in RADAR["dimensions"]:
        score, why = base[key]
        raw[key] = {"score": min(max(score + rng.choice([-1, 0, 0, 0, 1]), 0), 5), "why": why, "basis": "opis"}
    # Opis pomysłu zwykle nie mówi nic o efektach, a czasem też o tym, czy da się go powtórzyć.
    if stage == "pomysl":
        raw["wplyw"] = {**raw["wplyw"], "basis": "brak_danych", "why": "Opis nie mówi jeszcze, jakie będą efekty i dla ilu osób."}
        if rng.random() < 0.6:
            raw["skalowalnosc"] = {**raw["skalowalnosc"], "basis": "brak_danych",
                                   "why": "Nie wiadomo jeszcze, czego wymaga uruchomienie w innym miejscu."}
    stage_label = STAGES[stage]["label"]
    dims = {}
    for key, r in raw.items():
        score, rules = r["score"], []
        if r["basis"] == "brak_danych" and score > RADAR["noDataMax"]:
            rules.append(f"Karta nic o tym nie mówi: ocena obniżona z {score} do {RADAR['noDataMax']}.")
            score = RADAR["noDataMax"]
        if key == "dojrzalosc":
            cap, reason = 5, None
            if RADAR["maturityCap"][stage] < cap:
                cap, reason = RADAR["maturityCap"][stage], f"etap „{stage_label}” pozwala najwyżej na {RADAR['maturityCap'][stage]}"
            if kind == "technologiczna" and trl is not None and RADAR["trlMaturityCap"][str(trl)] < cap:
                cap, reason = RADAR["trlMaturityCap"][str(trl)], f"TRL {trl} pozwala najwyżej na {RADAR['trlMaturityCap'][str(trl)]}"
            if score > cap:
                rules.append(f"Ocena obniżona z {score} do {cap}: {reason}.")
                score = cap
        if key == "skalowalnosc" and stage == "przeniesiona" and score < RADAR["transferredMinScalability"]:
            rules.append(f"Ocena podniesiona z {score} do {RADAR['transferredMinScalability']}: inicjatywa działa już w innym miejscu.")
            score = RADAR["transferredMinScalability"]
        dims[key] = {"score": score, "why": r["why"], "evidence": None, "basis": r["basis"], "rules": rules}
    wk = weights_key(kind)
    signal = round(100 * sum(RADAR["weights"][wk][k] * d["score"] / 5 for k, d in dims.items()))
    return dims, signal, wk


def vary_numbers(rng: random.Random, text: str) -> str:
    """Kopie archetypu różnią się skalą efektów: liczby (poza latami i procentami) ×0,5–1,4."""
    def scale(m: re.Match) -> str:
        n = int(m.group(0))
        if n < 5 or 1990 <= n <= 2100 or m.string[m.end():m.end() + 1] == "%":
            return m.group(0)
        return str(max(2, round(n * rng.uniform(0.5, 1.4))))
    return re.sub(r"(?<![\d,.])\d+(?![\d,.])", scale, text)


def check_archetype(a: dict) -> None:
    check_keys("domains", a["domains"], DOMAINS)
    check_keys("cross", a["cross"], CROSS)
    check_keys("institutionType", a["institution_type"], INSTITUTION_TYPES)
    check_keys("stages", a["stages"], STAGES)
    check_keys("innovationKind", a["innovation_kind"], INNOVATION_KINDS)
    check_keys("sectors", a["sectors"], SECTORS)
    check_keys("creatorRoles", [c["role"] for c in a["creators"]], CREATOR_ROLES)
    if a.get("ip_status"):
        check_keys("ipStatus", a["ip_status"], IP_STATUSES)
    if (a["innovation_kind"] == "technologiczna") != ("trl" in a):
        sys.exit(f"{a['key']}: TRL ma tylko i zawsze innowacja technologiczna")


def make_initiatives(rng: random.Random, gminy: list[dict], used: set[str]):
    initiatives, adoptions, creators, institutions = [], [], [], {}
    for a in TEMPLATES["archetypes"]:
        check_archetype(a)
        pool = candidates(a["place"], gminy)
        n = rng.randint(*a.get("copies", COPIES))
        places: list[dict] = []
        while len(places) < min(n, len(set(g["teryt"] for g in pool))):
            g = rng.choices(pool, weights=[weight(x, a["cross"]) for x in pool])[0]
            if g not in places:
                places.append(g)

        # Kopia 0 to źródło (najdojrzalszy etap archetypu, najstarsza); kolejne mogą być jej adopcjami.
        mature = [s for s in ("przeniesiona", "dziala", "pilotaz", "pomysl") if s in a["stages"]]
        source = None
        for i, g in enumerate(places):
            stage = mature[0] if i == 0 else rng.choice(a["stages"])
            published = rng.random() < (0.9 if i == 0 else 0.7)
            status = rng.choices(*zip(*(PUBLISHED_STATUS if published else PRIVATE_STATUS).items()))[0]
            nomination = rng.random() < 0.25
            effects = ("Jeszcze nie sprawdzone w praktyce, autorzy planują pilotaż." if stage == "pomysl"
                       else vary_numbers(rng, a["effects"]))
            when = created_at(rng, 330, after=date.fromisoformat(source["created_at"][:10]) if source else None)
            slug = f"{a['key']}-{slugify(g['nazwa'])}"
            trl = trl_for(a["trl"], stage) if "trl" in a else None
            institution = institution_for(a, g, institutions)
            dims, signal, weights = assess(rng, a["radar"], stage, a["innovation_kind"], trl)
            row = {
                "id": uid("initiative", slug),
                "slug": slug,
                "archetype": a["key"],
                "status_code": status_code(rng, used),
                "submission_kind": "nomination" if nomination else "own",
                "title": a["title"],
                "summary": a["solution"].split(". ")[0].rstrip(".") + ".",
                "domains": a["domains"],
                "institution_type": a["institution_type"],
                "stage": stage,
                "cross_topics": a["cross"],
                "innovation_kind": a["innovation_kind"],
                "sectors": a["sectors"],
                "trl": trl,
                "ip_status": a.get("ip_status"),
                "institution_id": institution["id"],
                "teryt": g["teryt"],
                "municipality": g["nazwa"],
                "card": {
                    "title": a["title"],
                    "summary": a["solution"].split(". ")[0].rstrip(".") + ".",
                    "problem": a["problem"],
                    "solution": a["solution"],
                    "effects": effects,
                    "beneficiaries": a["beneficiaries"],
                    "domains": a["domains"],
                    "institutionType": a["institution_type"],
                    "stage": stage,
                    "cross": a["cross"],
                    "innovationKind": a["innovation_kind"],
                    "sectors": a["sectors"],
                    "trl": trl,
                    "ipStatus": a.get("ip_status"),
                    "creatorRoles": list(dict.fromkeys(c["role"] for c in a["creators"])),
                    "municipality": g["nazwa"],
                    "keywords": a["keywords"],
                    "clarity": round(rng.uniform(0.7, 0.95), 2),
                    "followUps": [],
                },
                "radar": {
                    "dimensions": dims,
                    "strengths": [dims[k]["why"] for k in sorted(dims, key=lambda k: -dims[k]["score"])[:2]],
                    "risks": [dims[k]["why"] for k in sorted(dims, key=lambda k: dims[k]["score"])[:1]],
                    "confidence": round(sum(d["basis"] == "opis" for d in dims.values()) / len(dims), 2),
                    "signal": signal,
                    "weights": weights,
                    "methodology": RADAR["methodologyVersion"],
                    "model": "seed",
                    "assessedAt": when,
                },
                "signal": signal,
                "status": status,
                "published": published,
                "nominations_count": rng.randint(1, 6) if nomination else rng.choice([0, 0, 0, 1, 2]),
                "created_at": when,
            }
            initiatives.append(row)
            # Twórcy: rola i opis bez imion. Podpis publiczny tylko za zgodą (u ucznia także opiekuna).
            for sort, c in enumerate(a["creators"]):
                minor = c["role"] == "uczen"
                guardian = minor and rng.random() < 0.5
                creators.append({
                    "id": uid("creator", slug, str(sort)), "initiative_id": row["id"], "sort": sort, "role": c["role"],
                    "display_name": f"{c['label'][0].upper()}{c['label'][1:]} (przykład)", "under_18": minor,
                    # Jak check creators_minor_needs_guardian (0007): bez zgody opiekuna podpis ucznia zostaje prywatny.
                    "guardian_consent": guardian, "show_publicly": rng.random() < 0.6 and (not minor or guardian),
                    "institution_id": institution["id"],
                })
            if i == 0:
                source = row
            elif source and stage in ("dziala", "przeniesiona", "pilotaz") and rng.random() < 0.4:
                done = stage != "pilotaz"
                fb = rng.choice(ADOPTION_FEEDBACK)
                adoptions.append({
                    "id": uid("adoption", slug),
                    "initiative_id": source["id"],
                    "adopter_org": f"{INSTITUTION_NAME[a['institution_type']]}, gm. {g['nazwa']} (przykład)",
                    "teryt": g["teryt"],
                    "status": "zakonczony" if done else "w_trakcie",
                    "rating": rng.choices([3, 4, 5], weights=[2, 5, 4])[0] if done else None,
                    "worked": fb[0] if done else None,
                    "improve": fb[1] if done else None,
                    "created_at": when,
                })
    return initiatives, adoptions, creators, list(institutions.values())


def make_challenges(rng: random.Random, gminy: list[dict]) -> list[dict]:
    out = []
    for n in range(CHALLENGE_COUNT):
        c = CHALLENGES[n % len(CHALLENGES)]
        check_keys("domains", c["domains"], DOMAINS)
        g = rng.choice(candidates(c["place"], gminy))
        gap = c.get("gap", False) and rng.random() < 0.85
        out.append({
            "id": uid("challenge", str(n)),
            "teryt": g["teryt"],
            "institution_type": c["institution"],
            "best_fit": rng.randint(20, 44) if gap else rng.randint(55, 92),
            "is_gap": gap,
            "card": {"summary": c["text"], "domains": c["domains"], "institutionType": c["institution"],
                     "municipality": g["nazwa"], "keywords": c["keywords"]},
            "created_at": created_at(rng, 200),
        })
    return out


def make_mentors() -> list[dict]:
    out = []
    for m in TEMPLATES["mentors"]:
        check_keys("domains", m["domains"], DOMAINS)
        check_keys("institutionType", m["institution_types"], INSTITUTION_TYPES)
        out.append({"id": uid("mentor", m["name"]), **m})
    return out


def make_programs() -> list[dict]:
    form = read_json(ROOT / "forms" / "program_demo.json")
    form.pop("_opis", None)
    out = []
    for n, p in enumerate(TEMPLATES["programs"]):
        check_keys("domains", p["domains"], DOMAINS)
        out.append({
            "id": uid("program", p["title"]), **p,
            "criteria": [{"name": c, "max": 25} for c in p["criteria"]],
            # Formularz /wniosek tylko dla otwartego programu; pozostałe mają same pola generatora.
            "form_schema": form if p["active"] else {"fields": form["fields"]},
            "opens_at": "2026-10-01" if p["active"] else ["2026-03-01", "2026-04-15"][n % 2],
            "closes_at": "2027-01-31" if p["active"] else ["2026-05-31", "2026-06-30"][n % 2],
        })
    return out


def make_partners(gminy: list[dict]) -> list[dict]:
    out = []
    for p in TEMPLATES["partners"]:
        check_keys("partnerKind", p["kind"], PARTNER_KINDS)
        check_keys("sectors", p["sectors"], SECTORS)
        check_keys("domains", p["domains"], DOMAINS)
        check_keys("partnerSupport", p["support"], PARTNER_SUPPORT)
        check_keys("stages", p["stages"], STAGES)
        g = gmina_by_name(p["place"], gminy)
        out.append({"id": uid("partner", p["slug"]), **{k: v for k, v in p.items() if k != "place"},
                    "teryt": g["teryt"], "municipality": g["nazwa"]})
    return out


def sql(initiatives, adoptions, challenges, mentors, programs, institutions, creators, partners) -> str:
    lines = [
        "-- Wygenerowane przez data/seed_initiatives.py — nie edytuj ręcznie. DANE SYNTETYCZNE (synthetic = true).",
        "-- Najpierw usuwamy poprzednie dane demo, więc plik można ładować wielokrotnie (load.py).",
        "delete from search_index where ref_id in (select id from initiatives where synthetic union all select id from challenges where synthetic"
        " union all select id from mentors where synthetic union all select id from programs where synthetic"
        " union all select id from partners where synthetic);",
        "delete from adoptions where synthetic;",
        "delete from creators where synthetic;",
        "delete from initiatives where synthetic;",
        "delete from institutions where synthetic;",
        "delete from partners where synthetic;",
        "delete from challenges where synthetic;",
        "delete from mentors where synthetic;",
        "delete from programs where synthetic;",
    ]
    for m in mentors:
        lines.append(upsert("mentors", "id", {"id": m["id"], "name": m["name"], "bio": m["bio"], "expertise": m["expertise"],
                                               "domains": m["domains"], "institution_types": m["institution_types"],
                                               "active": True, "synthetic": True}))
        lines.append(index_row("mentor", m["id"], m["name"], m["bio"], m["expertise"], domains=m["domains"]))
    for p in programs:
        lines.append(upsert("programs", "id", {"id": p["id"], "title": p["title"], "description": p["description"],
                                                "domains": p["domains"], "active": p["active"], "opens_at": p["opens_at"],
                                                "closes_at": p["closes_at"], "criteria": Jsonb(p["criteria"]),
                                                "form_schema": Jsonb(p["form_schema"]), "synthetic": True}))
        lines.append(index_row("program", p["id"], p["title"], p["description"],
                               [w for c in p["criteria"] for w in c["name"].lower().split() if len(w) > 4],
                               domains=p["domains"], active=p["active"]))
    for inst in institutions:
        lines.append(upsert("institutions", "id", {**inst, "synthetic": True}))
    for p in partners:
        lines.append(upsert("partners", "id", {
            "id": p["id"], "slug": p["slug"], "name": p["name"], "kind": p["kind"], "description": p["description"],
            "sectors": p["sectors"], "domains": p["domains"], "support": p["support"], "trl_min": p["trl_min"],
            "trl_max": p["trl_max"], "stages": p["stages"], "teryt": p["teryt"], "active": True, "synthetic": True}))
        lines.append(index_row("partner", p["id"], p["name"], p["description"], p["keywords"], domains=p["domains"],
                               tags=[p["kind"], *p["sectors"], *p["support"]], teryt=p["teryt"]))
    for i in initiatives:
        lines.append(upsert("initiatives", "id", {
            "id": i["id"], "status_code": i["status_code"], "slug": i["slug"], "submission_kind": i["submission_kind"],
            "card": Jsonb(i["card"]), "title": i["title"], "summary": i["summary"], "domains": i["domains"],
            "institution_type": i["institution_type"], "stage": i["stage"], "cross_topics": i["cross_topics"],
            "innovation_kind": i["innovation_kind"], "sectors": i["sectors"], "trl": i["trl"], "ip_status": i["ip_status"],
            "institution_id": i["institution_id"], "teryt": i["teryt"], "radar": Jsonb(i["radar"]), "signal": i["signal"], "status": i["status"],
            "published": i["published"], "nominations_count": i["nominations_count"], "synthetic": True,
            "created_at": i["created_at"], "updated_at": i["created_at"]}))
        c = i["card"]
        lines.append(index_row("initiative", i["id"], i["title"], f"{c['problem']} {c['solution']}", c["keywords"],
                               domains=i["domains"], tags=[i["stage"], *i["cross_topics"]],
                               institution_type=i["institution_type"], teryt=i["teryt"]))
    for c in challenges:
        lines.append(upsert("challenges", "id", {
            "id": c["id"], "card": Jsonb(c["card"]), "teryt": c["teryt"], "institution_type": c["institution_type"],
            "best_fit": c["best_fit"], "is_gap": c["is_gap"], "synthetic": True, "created_at": c["created_at"]}))
        lines.append(index_row("challenge", c["id"], c["card"]["summary"][:80], c["card"]["summary"], c["card"]["keywords"],
                               domains=c["card"]["domains"], institution_type=c["institution_type"], teryt=c["teryt"]))
    for c in creators:
        lines.append(upsert("creators", "id", {
            "id": c["id"], "role": c["role"], "display_name": c["display_name"], "under_18": c["under_18"],
            "guardian_consent": c["guardian_consent"], "show_publicly": c["show_publicly"],
            "institution_id": c["institution_id"], "synthetic": True}))
        lines.append(f"insert into initiative_creators (initiative_id, creator_id, sort) values ({lit(c['initiative_id'])}, "
                     f"{lit(c['id'])}, {c['sort']}) on conflict do nothing;")
    # Adopcje po inicjatywach: trigger adoptions_refresh_stats liczy adoptions_count i avg_rating.
    for a in adoptions:
        lines.append(upsert("adoptions", "id", {**a, "synthetic": True}))
    return "\n".join(lines) + "\n"


def main() -> None:
    rng = random.Random(RNG_SEED)
    gminy = read_json(OUT / "gminy.json")
    used: set[str] = set()
    initiatives, adoptions, creators, institutions = make_initiatives(rng, gminy, used)
    challenges = make_challenges(rng, gminy)
    mentors, programs, partners = make_mentors(), make_programs(), make_partners(gminy)

    if len({i["slug"] for i in initiatives}) != len(initiatives):
        sys.exit("Powtórzony slug inicjatywy")
    SEED.mkdir(parents=True, exist_ok=True)
    (SEED / "30_demo.sql").write_text(
        sql(initiatives, adoptions, challenges, mentors, programs, institutions, creators, partners), encoding="utf-8")
    write_json(OUT / "demo.json", {
        "_note": "DANE SYNTETYCZNE — wygenerowane przez data/seed_initiatives.py, nie dotyczą prawdziwych instytucji.",
        "initiatives": initiatives, "adoptions": adoptions, "challenges": challenges, "mentors": mentors, "programs": programs,
        "institutions": institutions, "creators": creators, "partners": partners,
    })

    levels = Counter(next(lv["key"] for lv in RADAR["levels"] if i["signal"] >= lv["min"]) for i in initiatives)
    counties = defaultdict(int)
    for i in initiatives:
        counties[i["teryt"][:4]] += 1
    print(f"supabase/seed/30_demo.sql: {len(initiatives)} inicjatyw ({sum(i['published'] for i in initiatives)} opublikowanych), "
          f"{len(adoptions)} adopcji, {len(challenges)} wyzwań ({sum(c['is_gap'] for c in challenges)} bez rozwiązania), "
          f"{len(mentors)} mentorów, {len(programs)} programy")
    print("Sygnał:", dict(levels), "| etapy:", dict(Counter(i["stage"] for i in initiatives)))
    print("Typy:", dict(Counter(i["innovation_kind"] for i in initiatives)),
          f"| z TRL: {sum(i['trl'] is not None for i in initiatives)} | instytucje: {len(institutions)}, twórcy: {len(creators)}, "
          f"partnerzy: {len(partners)}")
    print(f"Powiaty z inicjatywami: {len(counties)}; gminy: {len({i['teryt'] for i in initiatives})}")


if __name__ == "__main__":
    main()
