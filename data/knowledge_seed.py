"""Dane startowe Zasobnika wiedzy dla aplikacji: content/knowledge/*.json + supabase/seed_knowledge.sql.

Wejście: out/knowledge/ (scrape_knowledge.py, knowledge_facts.py, knowledge_personas.py).
Treści obszarów (definicja, zdanie na kafel, wyzwania) są napisane ręcznie prostym językiem na podstawie
Mapy Wyzwań Społecznych — dane w mapie są ogólnopolskie, co pokazujemy w UI.

Czego NIE ma na stronach ROPS, a uzupełniamy automatycznie (i oznaczamy w danych `*_auto = true`):
- obszary Mapy Wyzwań dla innowacji (Biblioteka podaje tylko kategorię „dla kogo”) — reguły na słowach,
- typ innowacji (przedmiot / metoda pracy / usługa / technologia) — reguły na słowach.
Admin poprawia oba pola w panelu „Zarządzaj wiedzą”. Przy indeksowaniu z kluczami API tagi liczy Haiku.

    cd data && uv run knowledge_seed.py"""
import json
import re
import uuid

from common import OUT, ROOT, write_json

SRC = OUT / "knowledge"
DEST = ROOT.parent / "content" / "knowledge"
SQL = ROOT.parent / "supabase" / "seed_knowledge.sql"
NS = uuid.UUID("6f1c2a52-3c1e-4c1b-9a0e-5a0a1b7d2e01")  # stałe UUID-y → idempotentny seed


def uid(*parts: str) -> str:
    return str(uuid.uuid5(NS, "|".join(parts)))


MAP_SOURCE = {
    "title": "Mapa Wyzwań Społecznych",
    "url": "https://rops.krakow.pl/mpliki/IS/IWS_20/za._nr_2._Mapa_Wyzwa_Spoecznych.pdf",
    "note": "Dane w Mapie Wyzwań są ogólnopolskie, nie dotyczą tylko Małopolski.",
}

# ── Obszary: tekst prostym językiem (ręcznie, na podstawie Mapy Wyzwań) ──
AREAS = [
    dict(key="seniorzy", name="Seniorzy", icon="HeartHandshake",
         lead="Samotność, zdrowie i pomoc w domu dla osób starszych.",
         definition="Ludzi starszych przybywa. Wielu z nich mieszka samotnie i potrzebuje pomocy w codziennym życiu. "
                    "Chodzi o to, żeby senior mógł żyć bezpiecznie, samodzielnie i wśród ludzi.",
         challenges=["Więcej opieki w domu, także w małych gminach.",
                     "Mniej samotności: miejsca i zajęcia, w których seniorzy spotykają się z innymi.",
                     "Nauka obsługi telefonu, komputera i urządzeń w mieście.",
                     "Bezpieczne branie leków i suplementów.",
                     "Mieszkania i przestrzeń bez barier dla osób starszych."]),
    dict(key="niepelnosprawnosc", name="Niepełnosprawność", icon="Accessibility",
         lead="Praca, nauka i samodzielne życie bez barier.",
         definition="Niepełnosprawność to trwała trudność w funkcjonowaniu ciała lub umysłu. Można się z nią urodzić "
                    "albo pojawia się po chorobie lub wypadku. Osoby z niepełnosprawnością potrzebują dostępu do pracy, "
                    "nauki, informacji i przestrzeni bez barier.",
         challenges=["Łatwiejszy dostęp do pracy.",
                     "Nauka, która daje samodzielność w dorosłym życiu.",
                     "Wsparcie w budowaniu przyjaźni i relacji.",
                     "Przestrzeń, transport i informacje dostępne dla wszystkich.",
                     "Mieszkania przystosowane do potrzeb."]),
    dict(key="rodzina_piecza", name="Rodzina i piecza zastępcza", icon="HouseHeart",
         lead="Wsparcie rodzin i dom dla dzieci, które nie mogą mieszkać z rodzicami.",
         definition="Niektóre rodziny mają trudności z opieką nad dziećmi. Wtedy pomagają im asystenci i specjaliści. "
                    "Gdy dziecko nie może mieszkać z rodzicami, trafia do rodziny zastępczej albo placówki.",
         challenges=["Więcej rodzin zastępczych.",
                     "Rodzeństwo powinno zostać razem.",
                     "Krótszy pobyt dziecka w pieczy zastępczej.",
                     "Lepsza współpraca między powiatami.",
                     "Jednakowe zasady adopcji w całym kraju."]),
    dict(key="zdrowie_psychiczne", name="Zdrowie psychiczne", icon="Brain",
         lead="Pomoc w kryzysie, stresie i depresji — dla dzieci i dorosłych.",
         definition="Zdrowie psychiczne to dobre samopoczucie, radzenie sobie ze stresem i dobre relacje z ludźmi. "
                    "Coraz więcej dzieci i dorosłych potrzebuje pomocy. Wiele osób nie szuka jej, bo się wstydzi.",
         challenges=["Wiedza o zdrowiu psychicznym dla dzieci, młodzieży i seniorów.",
                     "Pomoc rodzicom w rozpoznawaniu sygnałów, że dziecko ma problem.",
                     "Pomoc blisko domu zamiast w szpitalu.",
                     "Mniej wstydu i uprzedzeń wobec osób w kryzysie."]),
    dict(key="zdrowie", name="Zdrowie", icon="HeartPulse",
         lead="Dostęp do lekarza, rehabilitacji i opieki długoterminowej.",
         definition="Zdrowie to nie tylko leczenie, ale też zapobieganie chorobom i zdrowy styl życia. "
                    "Ważne jest, żeby każdy miał podobny dostęp do lekarzy i rehabilitacji.",
         challenges=["Wiedza o zdrowym stylu życia i zapobieganiu chorobom.",
                     "Równy dostęp do dobrej opieki medycznej.",
                     "Więcej opieki długoterminowej dla starzejących się mieszkańców.",
                     "Dbanie o zdrowie dzieci i młodzieży."]),
    dict(key="ubostwo", name="Ubóstwo", icon="HandCoins",
         lead="Gdy brakuje pieniędzy na jedzenie, ogrzewanie i rachunki.",
         definition="Ubóstwo to sytuacja, w której nie starcza pieniędzy na podstawowe potrzeby: jedzenie, mieszkanie, "
                    "ogrzewanie. Dotyka dzieci, seniorów, osób z niepełnosprawnością, a nawet osób, które pracują.",
         challenges=["Żłobki i przedszkola, które dają dzieciom równy start.",
                     "Praca i wsparcie dla osób bezrobotnych.",
                     "Pomoc dla seniorów i osób z niepełnosprawnością z niskimi dochodami.",
                     "Pieniądze na ogrzewanie domu.",
                     "Nikt nie powinien być głodny."]),
    dict(key="bezdomnosc", name="Bezdomność", icon="House",
         lead="Dach nad głową i droga z ulicy do własnego mieszkania.",
         definition="Osoba w kryzysie bezdomności nie ma swojego miejsca do życia. Przyczyn jest zwykle kilka naraz, "
                    "na przykład utrata pracy, długi, choroba albo uzależnienie. Coraz częściej dotyczy to młodych ludzi.",
         challenges=["Pomoc dla młodych osób bez domu, także niepełnoletnich.",
                     "Wsparcie dla osób, które opuszczają domy dziecka.",
                     "Noclegownie i schroniska przygotowane na potrzeby młodych.",
                     "Pomoc w odbudowaniu relacji z bliskimi."]),
    dict(key="cudzoziemcy", name="Integracja cudzoziemców", icon="Languages",
         lead="Nauka języka, praca i szkoła dla osób z innych krajów.",
         definition="Do Małopolski przyjeżdżają ludzie z innych krajów, na przykład z Ukrainy. Potrzebują mieszkania, pracy, "
                    "szkoły dla dzieci i pomocy po polsku i w swoim języku.",
         challenges=["Równy dostęp do usług, także dla osób, które nie mówią po polsku.",
                     "Tłumacz i asystent kulturowy w urzędach i szkołach.",
                     "Pomoc w szukaniu pracy i uznaniu kwalifikacji.",
                     "Wsparcie dla dzieci w szkole.",
                     "Mniej uprzedzeń wobec cudzoziemców."]),
]

GROUP_ICONS = {
    "seniorzy": "HeartHandshake", "dzieci_mlodziez_rodzina": "Users", "ograniczona_mobilnosc": "Accessibility",
    "niepelnosprawnosc_sensoryczna": "Ear", "zdrowie_medycyna": "Stethoscope", "rynek_pracy": "Briefcase",
    "cudzoziemcy": "Languages", "bezdomnosc": "House", "niepelnosprawnosc_intelektualna": "BookOpen",
}

# ── Obszary dla innowacji: kategoria „dla kogo” → obszar bazowy + słowa w opisie ──
GROUP_AREA = {
    "seniorzy": "seniorzy", "dzieci_mlodziez_rodzina": "rodzina_piecza", "ograniczona_mobilnosc": "niepelnosprawnosc",
    "niepelnosprawnosc_sensoryczna": "niepelnosprawnosc", "zdrowie_medycyna": "zdrowie", "rynek_pracy": "ubostwo",
    "cudzoziemcy": "cudzoziemcy", "bezdomnosc": "bezdomnosc", "niepelnosprawnosc_intelektualna": "niepelnosprawnosc",
}
AREA_WORDS = {
    "seniorzy": r"senior|osób starsz|osoby starsz|osobom starsz|podeszłym wieku|demencj|otępien",
    "zdrowie_psychiczne": r"psychi|depres|emocj|stres|lęk|samobój|kryzys",
    "zdrowie": r"rehabilit|chorob|zdrowi|lecz|pacjent|medycz|fizjoterap",
    "ubostwo": r"ubóstw|ubog|bezrobo|niskich dochod|wykluczeni|zatrudnieni|rynku pracy",
    "rodzina_piecza": r"rodzin|dzieci|dziecka|młodzież|piecz|adopc",
    "niepelnosprawnosc": r"niepełnospraw|niewidom|niesłysz|głuch|wózk|niedowid|spastycz",
    "cudzoziemcy": r"cudzozie|uchodź|ukrai|migrant|afgań|czecze",
    "bezdomnosc": r"bezdom",
}

# ── Typ innowacji: słowa w nazwie i opisie rozwiązania ──
TYPE_WORDS = {
    "technologia": r"aplikacj|platform|internet|online|cyfrow|\bvr\b|\bar\b|druk 3d|symulator|e-learning|elektroniczn|czujnik|ibeacon|nawigacj",
    "przedmiot": r"\bgra\b|gry |zestaw|tablic|kredk|wózek|wózk|mat[ay]? |obuwie|zabawk|puzzle|peleryn|odzież|łazienk|urządzeni|plansz|kart[ay]? |opowiada|kask|organizer|naszywk|naklejk",
    "metoda": r"model|metod|program|scenariusz|warsztat|szkoleni|trening|terapi|przewodnik|poradnik",
    "usluga": r"usług|wsparci|dyżur|asystent|mobiln|centrum|pomoc[ yi]",
}
TYPE_ORDER = ["przedmiot", "technologia", "usluga", "metoda"]

# ── „Łatwy tekst” napisany ręcznie dla innowacji ze ścieżki demo (bez LLM) ──
ETR = {
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

MATERIALS = [
    dict(kind="kanwa", title="Kanwa Innowacji Społecznych INNO AGH (Social Canvas)", year=2026,
         description="Trzy plansze do pracy nad pomysłem: problem, odbiorcy, rozwiązanie, koszty i partnerzy. Wydrukuj i wypełnij w zespole.",
         url="https://rops.krakow.pl/mpliki/IS/Moj_folder/INNO_AGH_-_SOCIAL_CANVAS.pdf", areas=[]),
    dict(kind="publikacja", title="Połącz kropki, czyli o sile innowacji społecznych w obszarze włączenia społecznego", year=2023,
         description="Historie innowacji z projektu „Inkubator Włączenia Społecznego”: kto je wymyślił, jak je testowano i co z tego wyszło.",
         url="https://rops.krakow.pl/mpliki/IS/PUBLIKACJE_INKUBATOROW/Pocz_kropki_Publikacja_IWS.pdf",
         areas=["niepelnosprawnosc", "seniorzy", "rodzina_piecza", "cudzoziemcy", "ubostwo", "bezdomnosc"]),
    dict(kind="publikacja", title="Innowacje społeczne dla dostępności", year=2022,
         description="Rozwiązania dla osób z niepełnosprawnością i seniorów, przetestowane w projekcie „Inkubator Dostępności”.",
         url="https://rops.krakow.pl/mpliki/IS/ikony_PUBLIKACJE/Innowacje_spoleczne_dla_dostepnosci.pdf",
         areas=["niepelnosprawnosc", "seniorzy"]),
    dict(kind="poradnik", title="Przewodnik po innowacjach społecznych", year=2019,
         description="Jak urząd albo organizacja może wspierać nowe pomysły. Doświadczenia „Małopolskiego Inkubatora Innowacji Społecznych”.",
         url="https://rops.krakow.pl/mpliki/IS/ikony_PUBLIKACJE/InnMalopolska_przewodnik_po_innowacjach.pdf",
         areas=["seniorzy", "niepelnosprawnosc"]),
    dict(kind="poradnik", title="Guide to social innovations", year=2019, language="en",
         description="Angielska wersja przewodnika po innowacjach społecznych.",
         url="https://rops.krakow.pl/mpliki/IS/PUBLIKACJE_INKUBATOROW/InnMalopolska_Guide_to_social_innovations_MIIS_ENG.pdf",
         areas=[]),
    dict(kind="raport", title="Mapa Wyzwań Społecznych", year=2024,
         description="Osiem najważniejszych obszarów problemów społecznych, z przykładami osób i listą raportów. Dane ogólnopolskie.",
         url=MAP_SOURCE["url"], areas=[a["key"] for a in AREAS]),
    dict(kind="raport", report="Usługi społeczne w Małopolsce – deficyty, potrzeby, potencjał rozwojowy. Zaktualizowane wnioski z diagnozy",
         description="Krótkie podsumowanie: gdzie w Małopolsce brakuje opieki, pomocy dla rodzin, seniorów i osób w kryzysie.",
         areas=["seniorzy", "niepelnosprawnosc", "bezdomnosc", "zdrowie_psychiczne", "rodzina_piecza", "zdrowie"]),
    dict(kind="raport", report="Piecza zastępcza w Małopolsce. Stan, potrzeby, wyzwania",
         description="Ile jest rodzin zastępczych, czego im brakuje i co można poprawić.", areas=["rodzina_piecza"]),
    dict(kind="raport", report="Domy pomocy społecznej w Małopolsce wobec wyzwań deinstytucjonalizacji opieki długoterminowej",
         description="Jak domy pomocy społecznej mogą pomagać także osobom, które w nich nie mieszkają.", areas=["seniorzy", "zdrowie"]),
    dict(kind="raport", report="Mieszkania wspomagane i treningowe w Małopolsce jako priorytet w rozwoju usług społecznych i deinstytucjonalizacji",
         description="Mieszkania, w których można uczyć się samodzielności: dla kogo są i co utrudnia ich tworzenie.",
         areas=["bezdomnosc", "niepelnosprawnosc", "rodzina_piecza"]),
    dict(kind="raport", report="Wyzwania i potrzeby sektora opiekuńczego w Małopolsce. Perspektywa opiekunów oraz podmiotów realizujących opiekę",
         description="Kim są opiekunowie osób starszych i chorych, ile pracują i czego potrzebują.", areas=["seniorzy", "zdrowie"]),
    dict(kind="raport", report="Opiekunowie rodzinni osób starszych – problemy, potrzeby, wyzwania dla polityki społecznej",
         description="Z czym zmagają się rodziny, które same opiekują się starszymi bliskimi.", areas=["seniorzy"]),
    dict(kind="film", video="senior-cuder", title="Senior CUDER — gra dla seniorów",
         description="Krótki film o grze, która pomaga seniorom rozmawiać i nawiązywać znajomości.", areas=["seniorzy"]),
    dict(kind="film", video="przenosne-modularne-lazienki", title="Przenośne, modularne łazienki",
         description="Jak w kilka dni zrobić łazienkę w mieszkaniu, w którym jej nie ma.", areas=["ubostwo", "seniorzy"]),
    dict(kind="film", video="hear-it", title="Hear IT — nauka programowania w polskim języku migowym",
         description="Platforma, na której osoby głuche uczą się zawodów w branży IT.", areas=["niepelnosprawnosc", "ubostwo"]),
]


def clean(s: str | None) -> str | None:
    if not s:
        return None
    s = re.sub(r"[ \t]+", " ", s).strip()
    s = re.sub(r"rozpowszechnianiasię", "rozpowszechniania się", s)  # literówka ze strony ROPS
    return s or None


def tag_areas(i: dict) -> list[str]:
    base = [GROUP_AREA[g] for g in i["groups"]]
    text = " ".join(filter(None, [i["title"], i["problem"], i["solution"], i["beneficiaries"]])).lower()
    scored = sorted(((len(re.findall(p, text)), k) for k, p in AREA_WORDS.items() if k not in base), reverse=True)
    extra = [k for n, k in scored if n >= 2]
    return list(dict.fromkeys(base + extra))[:3]


def tag_type(i: dict) -> str:
    text = " ".join(filter(None, [i["title"], i["title"], (i["solution"] or "")[:400]])).lower()
    scores = {t: len(re.findall(p, text)) for t, p in TYPE_WORDS.items()}
    best = max(TYPE_ORDER, key=lambda t: (scores[t], -TYPE_ORDER.index(t)))
    return best if scores[best] else "metoda"


def video_meta(v: dict | None, title: str) -> dict | None:
    if not v:
        return None
    t = v["title"]
    return {
        "youtube_id": v["youtube_id"],
        "title": f"Film: {title}",
        "thumbnail_url": v["thumbnail_url"],
        "sign_language": "PJM" in t,
        "captions": "napisy" in t.lower(),
    }


def build_innovations() -> list[dict]:
    raw = json.loads((SRC / "innovations.json").read_text(encoding="utf-8"))
    out = []
    for i in raw:
        title = clean(i["title"])
        out.append({
            "id": uid("innowacja", i["source_url"]),
            "slug": i["slug"],
            "title": title,
            "groups": i["groups"],
            "areas": tag_areas(i),
            "areas_auto": True,
            "innovation_type": tag_type(i),
            "type_auto": True,
            "problem": clean(i["problem"]),
            "solution": clean(i["solution"]),
            "evidence": clean(i["evidence"]),
            "who_can_use": clean(i["who_can_use"]),
            "beneficiaries": clean(i["beneficiaries"]),
            "etr_summary": ETR.get(i["slug"]),
            "video": video_meta(i["video"], title),
            "pdf_url": i["pdf_url"],
            "materials_zip": i["materials_zip"],
            "license_url": i["license_url"],
            "source_url": i["source_url"],
            "dissemination": bool(i["dissemination_badge"]),
            "published": True,
            "synthetic": False,
        })
    return out


def build_areas(personas: list[dict]) -> list[dict]:
    cmap = json.loads((SRC / "challenge_map.json").read_text(encoding="utf-8"))["areas"]
    out = []
    for n, a in enumerate(AREAS):
        out.append({
            "key": a["key"], "slug": a["key"].replace("_", "-"), "name": a["name"], "icon": a["icon"],
            "lead": a["lead"], "definition": a["definition"],
            "challenges": a["challenges"], "challenges_source": MAP_SOURCE,
            "reading": cmap[a["key"]]["further_reading"],
            "persona_keys": [p["key"] for p in personas if p["area"] == a["key"]],
            "sort": n, "published": True,
        })
    return out


def build_materials(innovations: list[dict]) -> list[dict]:
    reports = {r["title"]: r for r in json.loads((SRC / "reports.json").read_text(encoding="utf-8"))}
    pubs = {p["url"]: p for p in json.loads((SRC / "publications.json").read_text(encoding="utf-8"))}
    by_slug = {i["slug"]: i for i in innovations}
    out = []
    for n, m in enumerate(MATERIALS):
        item = {"kind": m["kind"], "description": m["description"], "areas": m["areas"],
                "language": m.get("language", "pl"), "sort": n, "published": True}
        if m.get("report"):
            r = reports[m["report"]]
            item.update(title=r["title"], year=r["year"], url=r["url"], format=r["format"], size_bytes=r["size_bytes"])
        elif m.get("video"):
            i = by_slug[m["video"]]
            item.update(title=m["title"], year=None, url=f"https://www.youtube.com/watch?v={i['video']['youtube_id']}",
                        format="film", size_bytes=None, sign_language=i["video"]["sign_language"],
                        captions=i["video"]["captions"], innovation_slug=i["slug"])
        else:
            p = pubs.get(m["url"])
            size = p["size_bytes"] if p else 7787592  # Mapa Wyzwań: rozmiar z pobranego pliku
            item.update(title=m["title"], year=m["year"], url=m["url"], format="PDF", size_bytes=size)
        item["id"] = uid("material", item["url"])
        out.append(item)
    return out


def build_facts() -> list[dict]:
    facts = json.loads((SRC / "facts.json").read_text(encoding="utf-8"))
    return [{**f, "id": uid("fakt", f["area"], f["quote"]), "published": True, "sort": n} for n, f in enumerate(facts)]


# ── SQL dla Supabase (migracja 0005_knowledge.sql musi być już zastosowana) ──

class Jsonb:
    """Wartość do kolumny jsonb (lista napisów domyślnie idzie jako text[])."""
    def __init__(self, value):
        self.value = value


def lit(v) -> str:
    if isinstance(v, Jsonb):
        return "'" + json.dumps(v.value, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (dict, list)) and not (isinstance(v, list) and all(isinstance(x, str) for x in v)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    if isinstance(v, list):
        return "array[" + ",".join(lit(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    return "'" + str(v).replace("'", "''") + "'"


def upsert(table: str, key: str, row: dict) -> str:
    cols = list(row)
    sets = ", ".join(f"{c} = excluded.{c}" for c in cols if c != key)
    return f"insert into {table} ({', '.join(cols)}) values ({', '.join(lit(row[c]) for c in cols)}) on conflict ({key}) do update set {sets};"


def sql(areas, facts, materials, innovations) -> str:
    lines = ["-- Wygenerowane przez data/knowledge_seed.py — nie edytuj ręcznie.", "begin;"]
    for a in areas:
        lines.append(upsert("areas", "key", {k: a[k] for k in ("key", "slug", "name", "icon", "lead", "definition", "sort", "published")}
                            | {"challenges": Jsonb(a["challenges"]), "challenges_source": a["challenges_source"], "reading": Jsonb(a["reading"])}))
    for f in facts:
        lines.append(upsert("facts", "id", {
            "id": f["id"], "area_key": f["area"], "value": f["value"], "unit": f["unit"], "display_value": f["display_value"],
            "sentence": f["sentence"], "data_year": f["data_year"], "source_title": f["source_title"],
            "source_publisher": f["source_publisher"], "source_url": f["source_url"], "source_year": f["source_year"],
            "source_page": f["source_page"], "quote": f["quote"], "is_example": f["is_example"], "sort": f["sort"], "published": True}))
    for m in materials:
        lines.append(upsert("materials", "id", {k: m.get(k) for k in (
            "id", "kind", "title", "description", "url", "format", "size_bytes", "language", "areas", "year", "sort", "published")}))
    for i in innovations:
        lines.append(upsert("innovations", "slug", {
            "id": i["id"], "slug": i["slug"], "title": i["title"], "category": i["groups"][0], "target_groups": i["groups"],
            "areas": i["areas"], "areas_auto": True, "innovation_type": i["innovation_type"], "type_auto": True,
            "problem": i["problem"], "solution": i["solution"], "evidence": i["evidence"], "who_can_use": i["who_can_use"],
            "beneficiaries": i["beneficiaries"], "etr_summary": i["etr_summary"], "source_url": i["source_url"],
            "pdf_url": i["pdf_url"], "video_url": i["video"] and f"https://www.youtube.com/watch?v={i['video']['youtube_id']}",
            "video": i["video"], "materials_zip": i["materials_zip"], "license_url": i["license_url"],
            "dissemination": i["dissemination"], "corpus": "biblioteka", "published": True, "synthetic": False}))
    lines.append("commit;")
    return "\n".join(lines) + "\n"


def main() -> None:
    personas = json.loads((SRC / "personas.json").read_text(encoding="utf-8"))
    innovations = build_innovations()
    areas = build_areas(personas)
    facts = build_facts()
    materials = build_materials(innovations)
    for name, data in [("areas", areas), ("facts", facts), ("materials", materials),
                       ("innovations", innovations), ("personas", personas)]:
        write_json(DEST / f"{name}.json", data)
    SQL.write_text(sql(areas, facts, materials, innovations), encoding="utf-8")
    print(f"obszary {len(areas)}, fakty {len(facts)}, materiały {len(materials)}, innowacje {len(innovations)}, persony {len(personas)}")


if __name__ == "__main__":
    main()
