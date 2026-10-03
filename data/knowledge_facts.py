"""Karty faktów „Małopolska w liczbach” do Zasobnika wiedzy — ręcznie wybrane, automatycznie sprawdzone.

Zasady (brief modułu II):
- Żadnych liczb z LLM. Każdy fakt z raportu ma dosłowny cytat (`quote`) i numer strony; skrypt sprawdza,
  że cytat naprawdę jest na tej stronie PDF-a. Jeśli nie ma — przerywa z błędem.
- Fakty z Obserwatora (IOSS) bierzemy wprost z tabeli dane/powiaty (rok 2024): podajemy najniższą i najwyższą
  wartość wśród powiatów, bez liczenia średnich dla województwa, których nikt nie opublikował.
- Zdania piszemy prostym językiem, ręcznie albo szablonem. Liczby w zdaniu = liczby w źródle.
- Dane z Mapy Wyzwań są ogólnopolskie, więc NIE trafiają do faktów o Małopolsce.

    cd data && uv run knowledge_facts.py   →  out/knowledge/facts.json"""
import csv
import re
import subprocess
import sys

from common import OUT, ROOT, write_json
from scrape_knowledge import _cache_path, fetch

DIAG_2025 = {
    "source_title": "Usługi społeczne w Małopolsce – deficyty, potrzeby, potencjał rozwojowy. Zaktualizowane wnioski z diagnozy",
    "source_publisher": "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    "source_url": "https://rops.krakow.pl/pliki-do-pobrania/wpis,2025-uslugi-spoleczne-w-malopolsce-deficyty-potrzeby-potencjal-rozwojowy-zaktualizowane-wnioski-z-diagnozy,1348",
    "source_year": 2025,
}

RODZINNA_2023 = {
    "source_title": "Diagnoza potrzeb, zasobów i potencjału rozwojowego (załącznik do Programu Wsparcia Rodziny „Rodzinna Małopolska 2030”)",
    "source_publisher": "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    "source_url": "https://rops.krakow.pl/pliki-do-pobrania/wpis,2023-diagnoza-potrzeb-zasobow-i-potencjalu-rozwojowego-zalacznik-do-programu-wsparcia-rodziny-rodzinna-malopolska-2030,856",
    "source_year": 2023,
}

# area: klucz z MWS_AREAS. src: raport (domyślnie DIAG_2025). display_value: jak liczbę czyta człowiek. data_year: rok, którego dotyczą dane.
REPORT_FACTS = [
    # ── Seniorzy ──
    dict(area="seniorzy", value=841.5, unit="tys. osób", display_value="841,5 tys.", data_year=2024, page=25,
         sentence="Tylu mieszkańców Małopolski ma ponad 60 lat. To prawie co czwarta osoba w regionie.",
         quote="Zamieszkiwało 841,5 tys. osób powyżej 60 roku życia (24,5% populacji regionu)"),
    dict(area="seniorzy", value=147, unit="tys. osób", display_value="147 tys.", data_year=2024, page=25,
         sentence="Tyle osób w Małopolsce ma 80 lat lub więcej. Ta grupa szybko rośnie.",
         quote="w tym 147 tysięcy osiemdziesięciolatków i starszych osób"),
    dict(area="seniorzy", value=93, unit="gmin", display_value="93 gminy", data_year=2024, page=28,
         sentence="W ponad połowie gmin nie ma publicznego dziennego domu pomocy ani klubu dla seniorów.",
         quote="a na terenie 93 gmin czyli w ponad połowie, nie funkcjonował ani dzienny dom pomocy, ani klub samopomocy"),
    dict(area="seniorzy", value=15, unit="gmin", display_value="15 gmin", data_year=2024, page=26,
         sentence="Tyle gmin nie organizowało własnych usług opiekuńczych, czyli pomocy w domu.",
         quote="Łącznie 15 małopolskich gmin – 8,2%"),
    # ── Niepełnosprawność ──
    dict(area="niepelnosprawnosc", value=473.1, unit="tys. osób", display_value="473,1 tys.", data_year=2021, page=35,
         sentence="Tyle osób w Małopolsce żyje z niepełnosprawnością. To prawie 14 na 100 mieszkańców.",
         quote="Mieszkało ok. 473,1 tys. osób niepełnosprawnych ogółem"),
    dict(area="niepelnosprawnosc", value=4.9, unit="tys. osób", display_value="prawie 4,9 tys.", data_year=2024, page=37,
         sentence="Tyle osób z niepełnosprawnością dostało pomoc asystenta osobistego.",
         quote="Usługami asystenta wsparto niemal 4,9 tys. osób z niepełnosprawnościami."),
    dict(area="niepelnosprawnosc", value=68, unit="warsztatów", display_value="68", data_year=2024, page=36,
         sentence="Tyle warsztatów terapii zajęciowej działa w regionie. Uczy się w nich 2908 osób.",
         quote="Funkcjonowało 68 warsztatów terapii zajęciowej"),
    # ── Bezdomność ──
    dict(area="bezdomnosc", value=2093, unit="osób", display_value="co najmniej 2093", data_year=2024, page=37,
         sentence="Tyle osób w kryzysie bezdomności policzono w Małopolsce. Naprawdę może ich być więcej.",
         quote="2 093 osoby w kryzysie bezdomności zidentyfikowano"),
    dict(area="bezdomnosc", value=2436, unit="rodzin", display_value="2436", data_year=2024, page=37,
         sentence="Tyle rodzin i osób samotnych dostało pomoc społeczną z powodu bezdomności.",
         quote="2 436 rodzin/ gospodarstw, głównie jednoosobowych, skorzystało z pomocy społecznej z powodu bezdomności"),
    dict(area="bezdomnosc", value=2, unit="schroniska", display_value="tylko 2", data_year=2024, page=38,
         sentence="Tylko tyle schronisk dla osób bezdomnych ma usługi opiekuńcze, na przykład dla starszych i chorych.",
         quote="tylko dwa schroniska dla osób bezdomnych w Małopolsce dysponowały usługami opiekuńczymi"),
    # ── Rodzina i piecza zastępcza ──
    dict(area="rodzina_piecza", value=3179, unit="dzieci", display_value="3179", data_year=2024, page=15,
         sentence="Tyle dzieci i nastolatków wychowuje się w rodzinach zastępczych i rodzinnych domach dziecka.",
         quote="a wychowywało się w nich 3 179 dzieci i młodzieży"),
    dict(area="rodzina_piecza", value=13, unit="powiatów", display_value="13 z 22", data_year=2024, page=15,
         sentence="W tylu powiatach brakuje rodzin zastępczych, które zajmą się dzieckiem z niepełnosprawnością.",
         quote="W ponad połowie małopolskich powiatów (13 na 22) nie funkcjonują zawodowe specjalistyczne rodziny zastępcze"),
    dict(area="rodzina_piecza", value=13, unit="gmin", display_value="13 gmin", data_year=2024, page=10,
         sentence="W tylu gminach rodzina w trudnej sytuacji nie mogła dostać pomocy asystenta rodziny.",
         quote="W 13 małopolskich gminach (7,1% wszystkich gmin) rodziny nie miały możliwości skorzystania ze wsparcia asystenta rodziny"),
    # ── Zdrowie psychiczne ──
    dict(area="zdrowie_psychiczne", value=1206, unit="prób", display_value="1206", data_year=2024, page=12,
         sentence="Tyle prób samobójczych odnotowano w Małopolsce. W 2015 roku było ich 898.",
         quote="W 2024 r. odnotowano 1 206 zamachów samobójczych w porównaniu do 898"),
    dict(area="zdrowie_psychiczne", value=12.1, unit="lekarzy na 100 tys.", display_value="12,1", data_year=2023, page=13,
         sentence="Tylu psychiatrów przypada na 100 tysięcy mieszkańców. Powinno być 20.",
         quote="z psychiatrii przypadająca na 100 tys. ludności wynosiła 12,1"),
    dict(area="zdrowie_psychiczne", value=10061, unit="osób", display_value="10 061", data_year=2024, page=11,
         sentence="Tyle osób szukało pomocy w ośrodkach interwencji kryzysowej.",
         quote="Z oferty OIK skorzystało w ciągu roku 10 061 osób"),
    # ── Zdrowie ──
    dict(area="zdrowie", value=592, unit="dni", display_value="592 dni", data_year=2019, page=34,
         sentence="Tyle średnio czekała osoba w stabilnym stanie na miejsce w zakładzie opiekuńczo-leczniczym. To najdłużej w Polsce.",
         quote="przeciętny czas oczekiwania na przyjęcie do ZOL dla przypadków stabilnych był najwyższy i wynosił 592 dni"),
    dict(area="zdrowie", value=55, unit="zakładów", display_value="55", data_year=2025, page=33,
         sentence="Tyle zakładów opiekuńczo-leczniczych i pielęgnacyjnych działa w regionie. Mają razem 3568 łóżek.",
         quote="działało 55 zakładów opiekuńczo-leczniczych i zakładów pielęgnacyjno-opiekuńczych z 3 568 łóżkami"),
    # ── Integracja cudzoziemców ──
    dict(area="cudzoziemcy", value=107.0, unit="tys. osób", display_value="107 tys.", data_year=2022, page=33, src=RODZINNA_2023,
         sentence="Tyle osób z Ukrainy dostało w Małopolsce pomoc społeczną w pierwszych 9 miesiącach 2022 roku.",
         quote="ze świadczeń pomocy społecznej skorzystało 107,0 tys. osób i 58,9 tys. rodzin"),
    dict(area="cudzoziemcy", value=2201, unit="dzieci", display_value="2201", data_year=2023, page=84, src=RODZINNA_2023,
         sentence="Tyle dzieci z Ukrainy było pod opieką opiekuna tymczasowego na początku 2023 roku.",
         quote="pod opieką opiekuna tymczasowego znajdowało się 2 201 dzieci i młodzieży z Ukrainy"),
]

IOSS = {
    "source_title": "Internetowy Obserwator Statystyk Społecznych",
    "source_publisher": "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    "source_url": "https://obserwator.rops.krakow.pl/",
}

# Wskaźnik z dane/powiaty → fakt „od … do …”. Zdanie: szablon z {min} {min_where} {max} {max_where}.
IOSS_FACTS = [
    dict(area="ubostwo", indicator="Beneficjenci pomocy społecznej", unit="%",
         sentence="Tylu mieszkańców korzysta z pomocy społecznej — zależnie od powiatu. Najmniej: {min_where} ({min}%). Najwięcej: {max_where} ({max}%)."),
    dict(area="ubostwo", indicator="Ubóstwo", unit="%",
         sentence="Tyle osób korzystających z pomocy społecznej dostaje ją z powodu ubóstwa. Najmniej: {min_where} ({min}%). Najwięcej: {max_where} ({max}%)."),
    dict(area="zdrowie", indicator="Długotrwała lub ciężka choroba", unit="%",
         sentence="Tyle osób korzystających z pomocy społecznej dostaje ją z powodu długiej lub ciężkiej choroby. Najmniej: {min_where} ({min}%). Najwięcej: {max_where} ({max}%)."),
]


def norm(s: str) -> str:
    """Do porównań: jedna spacja, bez łamań linii, bez spacji tysięcy przed cytatem („2 093” = „2 093”)."""
    return re.sub(r"\s+", " ", s.replace(" ", " ")).strip()


def page_text(url: str, page: int) -> str:
    fetch(url, ".pdf")
    path = _cache_path(url, ".pdf")
    out = subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), "-layout", str(path), "-"],
                         check=True, capture_output=True, text=True).stdout
    return norm(out)


def pl_number(x: float) -> str:
    return f"{x:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def report_facts() -> list[dict]:
    out, errors = [], []
    for f in REPORT_FACTS:
        src = f.get("src", DIAG_2025)
        text = page_text(src["source_url"], f["page"])
        if norm(f["quote"]) not in text:
            errors.append(f"[{f['area']}] s. {f['page']}: nie znaleziono cytatu „{f['quote']}”")
            continue
        out.append({**{k: v for k, v in f.items() if k not in ("page", "src")}, **src,
                    "source_page": f["page"], "is_example": False, "verified": "cytat sprawdzony w PDF"})
    if errors:
        sys.exit("\n".join(errors))
    return out


def ioss_facts() -> list[dict]:
    rows = list(csv.DictReader(open(ROOT.parent / "dane/powiaty/wszystkie_powiaty.csv", encoding="utf-8-sig")))
    out = []
    for f in IOSS_FACTS:
        values = [(r["powiat"], float(r["wartosc"]), r["rok"]) for r in rows if r["wskaznik"] == f["indicator"]]
        if len(values) < 20:
            sys.exit(f"Za mało powiatów dla wskaźnika {f['indicator']}: {len(values)}")
        lo, hi = min(values, key=lambda v: v[1]), max(values, key=lambda v: v[1])
        year = int(lo[2])
        out.append({
            "area": f["area"], "value": None, "unit": f["unit"],
            "display_value": f"od {pl_number(lo[1])} do {pl_number(hi[1])}%",
            "data_year": year,
            "sentence": f["sentence"].format(min=pl_number(lo[1]), max=pl_number(hi[1]), min_where=lo[0], max_where=hi[0]),
            "quote": f"Wskaźnik „{f['indicator']}”, {len(values)} powiatów i miast na prawach powiatu, {year} r.",
            **IOSS, "source_year": year, "source_page": None,
            "is_example": False, "verified": "wartości wprost z tabeli dane/powiaty/wszystkie_powiaty.csv",
        })
    return out


def main() -> None:
    facts = report_facts() + ioss_facts()
    write_json(OUT / "knowledge" / "facts.json", facts)
    by_area: dict[str, int] = {}
    for f in facts:
        by_area[f["area"]] = by_area.get(f["area"], 0) + 1
    print(f"{len(facts)} faktów: {by_area}", file=sys.stderr)


if __name__ == "__main__":
    main()
