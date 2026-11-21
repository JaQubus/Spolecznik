"""Zasobnik wiedzy Radaru: dziedziny, fakty, materiały i sprawdzone rozwiązania z Polski.

Wynik: ../supabase/seed/20_knowledge.sql (supabase db reset / load.py) i ../content/library/*.json
(tryb bez bazy: aplikacja czyta te same dane z plików).

Wejście:
- out/knowledge/innovations.json (scrape_library.py) — 115 innowacji z Biblioteki Innowacji Społecznych ROPS
  w Krakowie (CC BY 4.0, źródło przy każdej pozycji). W Radarze to „sprawdzone rozwiązania z Polski” (patterns).
- out/knowledge/facts.json (knowledge_facts.py) — fakty o regionie policzone z BDL.
- out/knowledge/publications.json (scrape_knowledge.py) — rozmiary plików publikacji.

Czego nie ma na stronach ROPS, a uzupełniamy regułami (i oznaczamy `domains_auto = true`, admin poprawia w Panelu):
dziedziny i typy instytucji, które mogą przenieść rozwiązanie, typ innowacji, słowa kluczowe do wyszukiwania.
Lepsze słowa kluczowe (z LLM) daje przycisk „Przelicz indeks” w Panelu.

    cd data && uv run knowledge_seed.py"""
import json
import re
import sys
import uuid
from collections import Counter

from common import CROSS, DOMAINS, INSTITUTION_TYPES, OUT, ROOT, SEED, Jsonb, check_keys, index_row, upsert, write_json

SRC = OUT / "knowledge"
DEST = ROOT.parent / "content" / "library"
NS = uuid.UUID("6f1c2a52-3c1e-4c1b-9a0e-5a0a1b7d2e01")  # stałe UUID-y → idempotentny seed


def uid(*parts: str) -> str:
    return str(uuid.uuid5(NS, "|".join(parts)))


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower().translate(str.maketrans("ąćęłńóśźż", "acelnoszz"))).strip("-")


# ── Dziedziny: tekst prostym językiem, napisany ręcznie. Bez liczb — liczby są w faktach z BDL. ──
DOMAIN_TEXT = {
    "edukacja": dict(
        icon="AcademicCapIcon", lead="Szkoły i przedszkola, które uczą nowocześnie i blisko domu.",
        definition="Edukacja to nie tylko lekcje. To także zajęcia po szkole, współpraca z rodzicami i firmami "
                   "oraz nauka umiejętności, które przydadzą się w pracy za kilkanaście lat.",
        challenges=["Równy dostęp do dobrych zajęć dla uczniów z małych szkół.",
                    "Nauczyciele, którzy umieją uczyć z nowymi narzędziami.",
                    "Kształcenie zawodowe dopasowane do firm z regionu.",
                    "Wsparcie dla uczniów w kryzysie i dla ich rodzin."]),
    "nauka": dict(
        icon="BeakerIcon", lead="Uczelnie, które pracują razem z gminami, szkołami i firmami.",
        definition="Transfer wiedzy to przenoszenie wyników badań i umiejętności z uczelni tam, gdzie mogą pomóc: "
                   "do urzędów, szkół i firm. Często zaczyna się od wspólnego projektu studentów i samorządu.",
        challenges=["Więcej wspólnych projektów uczelni i samorządów.",
                    "Badania, które odpowiadają na pytania gmin.",
                    "Studenci, którzy po studiach zostają w regionie.",
                    "Proste zasady współpracy uczelni z instytucjami."]),
    "cyfryzacja": dict(
        icon="ComputerDesktopIcon", lead="Narzędzia cyfrowe, które ułatwiają życie mieszkańcom i pracę urzędom.",
        definition="Cyfryzacja to usługi przez internet, dane, z których korzysta urząd, i umiejętności cyfrowe mieszkańców. "
                   "Dobra cyfryzacja nie zostawia nikogo z tyłu, także osób, które nie korzystają z internetu.",
        challenges=["Sprawy urzędowe do załatwienia przez internet.",
                    "Nauka korzystania z telefonu i komputera dla osób starszych.",
                    "Wykorzystanie danych do lepszych decyzji w gminie.",
                    "Bezpieczeństwo w sieci w szkołach i urzędach."]),
    "administracja": dict(
        icon="BuildingLibraryIcon", lead="Urzędy i instytucje, które działają sprawnie i po ludzku.",
        definition="Sprawna administracja to krótsze kolejki, zrozumiałe pisma i decyzje oparte na danych. "
                   "To także współpraca gmin, które razem mogą zrobić więcej niż osobno.",
        challenges=["Proste pisma i formularze.",
                    "Wspólne usługi kilku małych gmin.",
                    "Obsługa mieszkańców, którzy nie mówią dobrze po polsku.",
                    "Lepsze planowanie w gminach, w których ubywa mieszkańców."]),
    "srodowisko": dict(
        icon="SunIcon", lead="Czysta energia, woda i zieleń w gminach.",
        definition="Środowisko i energia to tańszy i czystszy prąd, oszczędzanie wody, mniej odpadów i przygotowanie "
                   "gmin na susze, ulewy i upały.",
        challenges=["Niższe rachunki za energię w budynkach publicznych.",
                    "Zatrzymywanie wody deszczowej.",
                    "Mniej odpadów i lepsza segregacja.",
                    "Ochrona przyrody, z której żyje turystyka."]),
    "zdrowie": dict(
        icon="HeartIcon", lead="Profilaktyka i opieka blisko domu, także dla zdrowia psychicznego.",
        definition="Zdrowie to szybki dostęp do lekarza, badania profilaktyczne, ruch i wsparcie psychologiczne. "
                   "W małych miejscowościach liczy się, żeby pomoc przyszła do mieszkańca, a nie odwrotnie.",
        challenges=["Szybsza pomoc psychologiczna dla dzieci i młodzieży.",
                    "Badania profilaktyczne w małych miejscowościach.",
                    "Opieka w domu dla osób starszych i chorych.",
                    "Więcej ruchu w każdym wieku."]),
    "uslugi_spoleczne": dict(
        icon="UsersIcon", lead="Pomoc dla seniorów, rodzin i osób z niepełnosprawnością.",
        definition="Usługi społeczne to pomoc w codziennym życiu: opieka nad seniorami, wsparcie rodzin, "
                   "asystencja osób z niepełnosprawnością. Najlepiej działają blisko domu i we współpracy z sąsiadami.",
        challenges=["Mniej samotności wśród osób starszych.",
                    "Opieka wytchnieniowa dla rodzin, które opiekują się bliskimi.",
                    "Samodzielne życie osób z niepełnosprawnością.",
                    "Wsparcie dla młodych, którzy opuszczają pieczę zastępczą."]),
    "mobilnosc": dict(
        icon="TruckIcon", lead="Dojazd do szkoły, pracy i lekarza bez własnego samochodu.",
        definition="Mobilność to możliwość dojechania tam, gdzie trzeba: autobusem, busem na telefon, rowerem albo pieszo. "
                   "Na wsi brak transportu odcina od pracy, szkoły i usług.",
        challenges=["Transport w gminach, w których autobus jeździ rzadko.",
                    "Bezpieczna droga do szkoły.",
                    "Przystanki i chodniki dostępne dla wszystkich.",
                    "Połączenia między gminami i z miastami."]),
    "kultura": dict(
        icon="BookOpenIcon", lead="Domy kultury, biblioteki i muzea jako miejsca spotkań.",
        definition="Kultura to nie tylko wydarzenia. Biblioteka czy dom kultury bywa jedynym miejscem spotkań we wsi. "
                   "Dziedzictwo regionu może też przyciągać turystów i dawać pracę.",
        challenges=["Biblioteki i domy kultury, do których chętnie przychodzi młodzież.",
                    "Ochrona i pokazywanie dziedzictwa regionu.",
                    "Kultura dostępna dla osób z niepełnosprawnością.",
                    "Turystyka, która zostawia pieniądze w gminie."]),
    "gospodarka": dict(
        icon="BriefcaseIcon", lead="Praca, przedsiębiorczość i lokalna gospodarka.",
        definition="Gospodarka to miejsca pracy, nowe firmy i dochody mieszkańców. Instytucje publiczne mogą pomóc: "
                   "uczyć przedsiębiorczości, łączyć szkoły z firmami i wspierać lokalnych producentów.",
        challenges=["Praca dla młodych, żeby nie musieli wyjeżdżać.",
                    "Sprzedaż lokalnych produktów bez pośredników.",
                    "Nauka przedsiębiorczości w szkołach.",
                    "Powrót do pracy rodziców i osób starszych."]),
    "partycypacja": dict(
        icon="ChatBubbleLeftRightIcon", lead="Mieszkańcy, którzy współdecydują o swojej okolicy.",
        definition="Partycypacja to udział mieszkańców w decyzjach: konsultacje, budżety obywatelskie, rady młodzieżowe, "
                   "wolontariat. Gdy ludzie mają wpływ, chętniej dbają o wspólne sprawy.",
        challenges=["Konsultacje, w których biorą udział nie tylko ci sami ludzie.",
                    "Młodzi z realnym wpływem na decyzje.",
                    "Wolontariat w małych miejscowościach.",
                    "Współpraca urzędów z organizacjami i sołectwami."]),
}

# ── Sprawdzone rozwiązania (ROPS): kategoria „dla kogo” → dziedziny i tematy przekrojowe ──
GROUP_DOMAINS = {
    "seniorzy": ["uslugi_spoleczne"], "dzieci_mlodziez_rodzina": ["uslugi_spoleczne", "edukacja"],
    "niepelnosprawnosc_sensoryczna": ["uslugi_spoleczne"], "ograniczona_mobilnosc": ["uslugi_spoleczne", "mobilnosc"],
    "niepelnosprawnosc_intelektualna": ["uslugi_spoleczne"], "zdrowie_medycyna": ["zdrowie"],
    "cudzoziemcy": ["uslugi_spoleczne"], "rynek_pracy": ["gospodarka"], "bezdomnosc": ["uslugi_spoleczne"],
}
GROUP_CROSS = {"seniorzy": ["seniorzy"], "dzieci_mlodziez_rodzina": ["mlodzi"]}
DOMAIN_WORDS = {
    "cyfryzacja": r"aplikacj|platform|internet|online|cyfrow|e-learning|smartfon|\bvr\b",
    "zdrowie": r"rehabilit|chorob|zdrowi|lecz|pacjent|medycz|fizjoterap|psychi|depres",
    "edukacja": r"szkoł|uczni|nauczyc|edukac|przedszkol",
    "kultura": r"kultur|muze|teatr|bibliotek|sztuk",
    "mobilnosc": r"transport|dojazd|przestrze|nawigacj",
    "gospodarka": r"zatrudni|rynku pracy|pracodaw|zawod|bezrobo",
    "partycypacja": r"wolontari|sąsiedz|społecznoś",
}
INSTITUTION_WORDS = {  # „Kto może skorzystać” → kto może przenieść rozwiązanie do siebie
    "szkola_podstawowa": r"szkoł|przedszkol",
    "szkola_ponadpodstawowa": r"szkoł|liceum|techni",
    "uczelnia": r"uczelni|uniwersyte|student",
    "gmina": r"gmin|samorząd|urzęd",
    "powiat": r"powiat|pcpr",
    "kultura": r"bibliotek|dom[yu]? kultury|muze|ośrod\w* kultury",
    "pomoc_zdrowie": r"pomocy społecznej|\bops\b|\bdps\b|\bcus\b|placów|szpital|przychodn|terapii zajęciow|środowiskow",
    "inna": r"urzęd\w* pracy",
}

# Słowa kluczowe w formie podstawowej (jak lematy z LLM w lib/search.ts) — wykrywane po rdzeniach.
LEMMAS = {
    "senior": r"senior|osób starsz|osoby starsz|osobom starsz|podeszłym wieku", "demencja": r"demencj|otępien",
    "samotność": r"samotn|izolacj", "opiekun": r"opiekun", "opieka": r"opiek",
    "niepełnosprawność": r"niepełnospraw", "osoba niewidoma": r"niewidom|niedowid", "osoba głucha": r"niesłysz|głuch",
    "język migowy": r"migow|\bpjm\b", "wózek": r"wózk|wózek", "dostępność": r"dostępn|barier",
    "niepełnosprawność intelektualna": r"intelektualn", "autyzm": r"autyz|spektrum",
    "dziecko": r"dzieci|dziecka|dziecko", "młodzież": r"młodzież|nastolat", "rodzina": r"rodzin", "rodzic": r"rodzic",
    "piecza zastępcza": r"piecz", "szkoła": r"szkoł", "uczeń": r"uczni|uczeń", "nauczyciel": r"nauczyc",
    "zdrowie psychiczne": r"psychi|emocj|depres|lęk", "rehabilitacja": r"rehabilit|fizjoterap|uspraw",
    "choroba": r"chorob", "pacjent": r"pacjent", "szpital": r"szpital", "profilaktyka": r"profilakty",
    "cudzoziemiec": r"cudzozie|migrant|uchodź", "integracja": r"integrac", "język polski": r"języka polskiego|język polski",
    "bezdomność": r"bezdom", "mieszkanie": r"mieszka[nń]", "ubóstwo": r"ubóstw|ubog",
    "praca": r"\bprac[ayę]\b|zatrudni", "rynek pracy": r"rynku pracy|rynek pracy", "aktywizacja zawodowa": r"aktywizac",
    "aplikacja": r"aplikacj", "platforma internetowa": r"platform", "kompetencje cyfrowe": r"cyfrow|komputer|smartfon",
    "gra": r"\bgra\b|\bgry\b|\bgier\b|planszow", "warsztat": r"warsztat", "szkolenie": r"szkoleni",
    "wolontariat": r"wolontari", "sąsiad": r"sąsiad", "transport": r"transport|dojazd|dowóz",
    "kultura": r"kultur", "sport": r"sport|aktywnoś\w* fizyczn", "terapia": r"terapi",
    "komunikacja": r"komunikac", "bezpieczeństwo": r"bezpiecz", "przemoc": r"przemoc", "uzależnienie": r"uzależni",
    "pamięć": r"pamię", "edukacja": r"edukac", "usługa społeczna": r"usług\w* społeczn",
}

INNOVATION_TYPES = {  # typ innowacji: słowa w nazwie i opisie rozwiązania
    "technologia": r"aplikacj|platform|internet|online|cyfrow|\bvr\b|\bar\b|druk 3d|symulator|e-learning|elektroniczn|czujnik|ibeacon|nawigacj",
    "przedmiot": r"\bgra\b|gry |zestaw|tablic|kredk|wózek|wózk|mat[ay]? |obuwie|zabawk|puzzle|peleryn|odzież|łazienk|urządzeni|plansz|kart[ay]? |opowiada|kask|organizer|naszywk|naklejk",
    "metoda": r"model|metod|program|scenariusz|warsztat|szkoleni|trening|terapi|przewodnik|poradnik",
    "usluga": r"usług|wsparci|dyżur|asystent|mobiln|centrum|pomoc[ yi]",
}
TYPE_ORDER = ["przedmiot", "technologia", "usluga", "metoda"]

ETR = {  # „Łatwy tekst” napisany ręcznie dla kilku rozwiązań (bez LLM)
    "senior-cuder": "To gra w karty dla seniorów. Gra się w grupie, na przykład w klubie seniora. "
                    "Gra pomaga rozmawiać o zdrowiu, emocjach i bliskich. Dzięki niej seniorzy poznają nowych ludzi i czują się mniej samotni.",
    "merkury": "To strona internetowa do ćwiczeń. Można na niej spróbować, jak działa bankomat, paczkomat, parkomat i kasa w sklepie. "
               "Ćwiczysz w domu, bez stresu. Potem łatwiej Ci zrobić to samo w mieście.",
    "mobilne-centrum-pomocy-dla-osob-starszych": "Specjaliści przyjeżdżają do domu seniora na wsi. Pomagają w sprawach prawnych, pieniądzach, diecie i ruchu. "
                    "Senior nie musi jechać do miasta. Dzięki temu czuje się mniej samotny i potrzebny.",
    "bawita": "To drewniana tablica z ruchomymi elementami. Ćwiczy pamięć i sprawność rąk. "
              "Pomaga osobom starszym z demencją i osobom po udarze.",
    "kody-qr-na-pomoc-seniorom": "Senior ma na ubraniu naklejkę z kodem. Gdy się zgubi, ktoś skanuje kod telefonem. "
                    "Widzi wtedy, jak pomóc i do kogo zadzwonić.",
    "organizator-kompleksowej-opieki-w-miejscu-zamieszkania": "Gdy chory senior wraca ze szpitala do domu, pielęgniarka przychodzi w ciągu doby. "
                    "Pomaga rodzinie zorganizować opiekę, sprzęt i pomoc z urzędów.",
}

SOURCE_NAME = "Biblioteka Innowacji Społecznych, ROPS w Krakowie"

# ── Materiały: publikacje o tym, jak wspierać i sprawdzać innowacje, i filmy z Biblioteki ──
MATERIALS = [
    dict(kind="kanwa", title="Kanwa Innowacji Społecznych INNO AGH (Social Canvas)", year=2026, publisher="AGH w Krakowie",
         description="Trzy plansze do pracy nad pomysłem: problem, odbiorcy, rozwiązanie, koszty i partnerzy. Wydrukuj i wypełnij w zespole.",
         url="https://rops.krakow.pl/mpliki/IS/Moj_folder/INNO_AGH_-_SOCIAL_CANVAS.pdf", domains=[]),
    dict(kind="poradnik", title="Przewodnik po innowacjach społecznych", year=2019, publisher="ROPS w Krakowie",
         description="Jak urząd albo instytucja może wspierać nowe pomysły: od pierwszego opisu do testu i upowszechnienia.",
         url="https://rops.krakow.pl/mpliki/IS/ikony_PUBLIKACJE/InnMalopolska_przewodnik_po_innowacjach.pdf",
         domains=["administracja", "partycypacja"]),
    dict(kind="poradnik", title="Guide to social innovations", year=2019, language="en", publisher="ROPS w Krakowie",
         description="Angielska wersja przewodnika po innowacjach społecznych.",
         url="https://rops.krakow.pl/mpliki/IS/PUBLIKACJE_INKUBATOROW/InnMalopolska_Guide_to_social_innovations_MIIS_ENG.pdf",
         domains=[]),
    dict(kind="publikacja", title="Połącz kropki, czyli o sile innowacji społecznych w obszarze włączenia społecznego", year=2023,
         publisher="ROPS w Krakowie",
         description="Historie innowacji: kto je wymyślił, jak je testowano i co z tego wyszło. Przykłady, jak sprawdzić pomysł w praktyce.",
         url="https://rops.krakow.pl/mpliki/IS/PUBLIKACJE_INKUBATOROW/Pocz_kropki_Publikacja_IWS.pdf",
         domains=["uslugi_spoleczne"]),
    dict(kind="publikacja", title="Innowacje społeczne dla dostępności", year=2022, publisher="ROPS w Krakowie",
         description="Rozwiązania dla osób z niepełnosprawnością i seniorów, przetestowane w instytucjach.",
         url="https://rops.krakow.pl/mpliki/IS/ikony_PUBLIKACJE/Innowacje_spoleczne_dla_dostepnosci.pdf",
         domains=["uslugi_spoleczne", "mobilnosc"]),
    dict(kind="film", video="merkury", title="Merkury — ćwiczenia z automatów w mieście",
         description="Strona, na której seniorzy ćwiczą obsługę biletomatu, bankomatu i paczkomatu.", domains=["cyfryzacja"]),
    dict(kind="film", video="hear-it", title="Hear IT — nauka programowania w polskim języku migowym",
         description="Platforma, na której osoby głuche uczą się zawodów w branży IT.", domains=["cyfryzacja", "gospodarka"]),
    dict(kind="film", video="senior-cuder", title="Senior CUDER — gra dla seniorów",
         description="Krótki film o grze, która pomaga seniorom rozmawiać i nawiązywać znajomości.", domains=["uslugi_spoleczne"]),
]


def clean(s: str | None) -> str | None:
    if not s:
        return None
    s = re.sub(r"[ \t]+", " ", s).strip()
    s = re.sub(r"rozpowszechnianiasię", "rozpowszechniania się", s)  # literówka ze strony ROPS
    return s or None


def hits(patterns: dict[str, str], text: str, min_hits: int = 1) -> list[str]:
    """Klucze, których wzorce występują w tekście co najmniej min_hits razy, od najczęstszych."""
    scored = [(len(re.findall(p, text)), k) for k, p in patterns.items()]
    return [k for n, k in sorted(scored, key=lambda x: -x[0]) if n >= min_hits]


def tag_type(i: dict) -> str:
    text = " ".join(filter(None, [i["title"], i["title"], (i["solution"] or "")[:400]])).lower()
    scores = {t: len(re.findall(p, text)) for t, p in INNOVATION_TYPES.items()}
    best = max(TYPE_ORDER, key=lambda t: (scores[t], -TYPE_ORDER.index(t)))
    return best if scores[best] else "metoda"


def video_meta(v: dict | None, title: str) -> dict | None:
    if not v:
        return None
    return {"youtube_id": v["youtube_id"], "title": f"Film: {title}", "thumbnail_url": v["thumbnail_url"],
            "sign_language": "PJM" in v["title"], "captions": "napisy" in v["title"].lower()}


def build_patterns() -> list[dict]:
    raw = json.loads((SRC / "innovations.json").read_text(encoding="utf-8"))
    out = []
    for i in raw:
        title = clean(i["title"])
        text = " ".join(filter(None, [title, i["problem"], i["solution"], i["beneficiaries"]])).lower()
        base = [d for g in i["groups"] for d in GROUP_DOMAINS[g]]
        domains = list(dict.fromkeys(base + hits(DOMAIN_WORDS, text, min_hits=2)))[:3]
        cross = list(dict.fromkeys(c for g in i["groups"] for c in GROUP_CROSS.get(g, [])))
        if "seniorzy" in cross and re.search(DOMAIN_WORDS["cyfryzacja"], text):
            cross.append("wykluczenie_cyfrowe")
        institutions = hits(INSTITUTION_WORDS, (i["who_can_use"] or "").lower()) or ["pomoc_zdrowie", "gmina"]
        check_keys("domains", domains, DOMAINS)
        check_keys("cross", cross, CROSS)
        check_keys("institutionType", institutions, INSTITUTION_TYPES)
        out.append({
            "id": uid("innowacja", i["source_url"]),
            "slug": i["slug"], "title": title, "category": i["groups"][0],
            "domains": domains, "cross_topics": cross, "institution_types": institutions, "domains_auto": True,
            "innovation_type": tag_type(i),
            "problem": clean(i["problem"]), "solution": clean(i["solution"]), "evidence": clean(i["evidence"]),
            "who_can_use": clean(i["who_can_use"]), "beneficiaries": clean(i["beneficiaries"]),
            "etr_summary": ETR.get(i["slug"]),
            "lemmas": hits(LEMMAS, text)[:15],
            "video": video_meta(i["video"], title),
            "video_url": i["video"] and f"https://www.youtube.com/watch?v={i['video']['youtube_id']}",
            "pdf_url": i["pdf_url"], "materials_zip": i["materials_zip"], "license_url": i["license_url"],
            "source_url": i["source_url"], "source_name": SOURCE_NAME,
            "dissemination": bool(i["dissemination_badge"]),
        })
    return out


def build_domains() -> list[dict]:
    if set(DOMAIN_TEXT) != set(DOMAINS):
        sys.exit(f"DOMAIN_TEXT nie zgadza się z config/taxonomy.json: {set(DOMAIN_TEXT) ^ set(DOMAINS)}")
    return [{"key": k, "slug": DOMAINS[k]["slug"], "name": DOMAINS[k]["label"], **DOMAIN_TEXT[k], "reading": [], "sort": n}
            for n, k in enumerate(DOMAINS)]


def build_materials(patterns: list[dict]) -> list[dict]:
    pubs = {p["url"]: p for p in json.loads((SRC / "publications.json").read_text(encoding="utf-8"))}
    by_slug = {p["slug"]: p for p in patterns}
    out = []
    for n, m in enumerate(MATERIALS):
        check_keys("domains", m["domains"], DOMAINS)
        item = {"kind": m["kind"], "title": m["title"], "slug": slugify(m["title"])[:60], "description": m["description"],
                "domains": m["domains"], "language": m.get("language", "pl"), "sort": n}
        if m.get("video"):
            p = by_slug[m["video"]]
            item.update(year=None, url=p["video_url"], format="film", size_bytes=None, publisher="ROPS w Krakowie",
                        sign_language=p["video"]["sign_language"], captions=p["video"]["captions"], pattern_slug=p["slug"])
        else:
            pub = pubs.get(m["url"])
            item.update(year=m["year"], url=m["url"], format="PDF", size_bytes=pub["size_bytes"] if pub else None,
                        publisher=m["publisher"])
        item["id"] = uid("material", item["url"])
        out.append(item)
    return out


def build_facts() -> list[dict]:
    facts = json.loads((SRC / "facts.json").read_text(encoding="utf-8"))
    if any("domain" not in f for f in facts):
        print("! out/knowledge/facts.json ma stary format (bez domain) — uruchom knowledge_facts.py; pomijam fakty", file=sys.stderr)
        return []
    check_keys("domains", [f["domain"] for f in facts], DOMAINS)
    return [{**f, "id": uid("fakt", f["domain"], f["quote"]), "sort": n} for n, f in enumerate(facts)]


def sql(domains, facts, materials, patterns) -> str:
    lines = ["-- Wygenerowane przez data/knowledge_seed.py — nie edytuj ręcznie.",
             # Fakty liczymy od nowa z BDL: stare (np. z innego roku danych) nie mogą zostać obok nowych.
             "delete from facts;"]
    for d in domains:
        lines.append(upsert("domains", "key", {
            "key": d["key"], "slug": d["slug"], "name": d["name"], "icon": d["icon"], "lead": d["lead"],
            "definition": d["definition"], "challenges": Jsonb(d["challenges"]), "reading": Jsonb(d["reading"]),
            "sort": d["sort"], "published": True}))
        lines.append(index_row("domain", uid("domain", d["key"]), d["name"], f"{d['lead']} {d['definition']}",
                               [d["name"].lower(), *DOMAINS[d["key"]]["description"].split(", ")], domains=[d["key"]]))
    for f in facts:
        lines.append(upsert("facts", "id", {
            "id": f["id"], "domain_key": f["domain"], "value": f["value"], "unit": f["unit"], "display_value": f["display_value"],
            "sentence": f["sentence"], "data_year": f["data_year"], "source_title": f["source_title"],
            "source_publisher": f["source_publisher"], "source_url": f["source_url"], "source_year": f["source_year"],
            "source_page": f["source_page"], "quote": f["quote"], "is_example": f["is_example"], "sort": f["sort"],
            "published": True}))
    for m in materials:
        lines.append(upsert("materials", "id", {k: m.get(k) for k in (
            "id", "slug", "kind", "title", "description", "url", "format", "size_bytes", "language", "publisher",
            "domains", "year", "sort")} | {"published": True}))
        lines.append(index_row("material", m["id"], m["title"], m["description"],
                               [w for w in re.findall(r"\w+", m["title"].lower()) if len(w) > 4], domains=m["domains"]))
    for p in patterns:
        lines.append(upsert("patterns", "slug", {k: p[k] for k in (
            "id", "slug", "title", "category", "domains", "cross_topics", "institution_types", "domains_auto",
            "innovation_type", "problem", "solution", "evidence", "who_can_use", "beneficiaries", "etr_summary",
            "video_url", "video", "pdf_url", "materials_zip", "license_url", "source_url", "source_name", "dissemination")}
            | {"published": True, "synthetic": False}))
        lines.append(index_row("pattern", p["id"], p["title"], f"{p['problem'] or ''} {p['solution'] or ''}".strip(),
                               p["lemmas"], domains=p["domains"], tags=p["cross_topics"]))
    return "\n".join(lines) + "\n"


def main() -> None:
    patterns = build_patterns()
    domains = build_domains()
    facts = build_facts()
    materials = build_materials(patterns)
    for name, data in [("domains", domains), ("facts", facts), ("materials", materials), ("patterns", patterns)]:
        write_json(DEST / f"{name}.json", data)
    SEED.mkdir(parents=True, exist_ok=True)
    (SEED / "20_knowledge.sql").write_text(sql(domains, facts, materials, patterns), encoding="utf-8")
    print(f"dziedziny {len(domains)}, fakty {len(facts)}, materiały {len(materials)}, rozwiązania {len(patterns)}")
    print("Rozwiązania po dziedzinach:", dict(Counter(d for p in patterns for d in p["domains"])))
    print("Typy instytucji:", dict(Counter(t for p in patterns for t in p["institution_types"])))
    print("Mniej niż 3 słowa kluczowe:", [p["slug"] for p in patterns if len(p["lemmas"]) < 3])


if __name__ == "__main__":
    main()
