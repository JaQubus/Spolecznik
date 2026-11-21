"""Interreg 2021–2027: projekty z partnerem wiodącym — instytucją publiczną z regionu. PRAWDZIWE dane.

Źródło: „Wykaz projektów Interreg 2021–2027” (art. 49 ust. 3 rozporządzenia (UE) 2021/1060) z interreg.gov.pl/lista-projektow/,
plik XLSX aktualizowany co kilka tygodni. Wykaz zawiera tylko nazwy instytucji (bez osób). Importer szuka linku do
najnowszego pliku na stronie listy, pobiera go do raw/sources/download/interreg/ i bierze projekty, których partner wiodący
ma siedzibę w regionie (kolumna województwa) i jest podmiotem publicznym (gmina, powiat, województwo, uczelnia, szkoła,
instytucja kultury, park narodowy…). Stowarzyszenia, fundacje i spółki pomijamy.

    cd data && uv run sources/interreg.py            # pobiera świeży wykaz
    cd data && uv run sources/interreg.py --offline  # przetwarza ostatnio pobrany plik
"""
import re
import sys
from pathlib import Path

import httpx
import openpyxl

from base import (DOWNLOADS, USER_AGENT, institution_type, is_regional_public, normalize, rural_by_name, save_snapshot,
                  teryt_for)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from region import REGION, TERYT_PREFIX  # noqa: E402

LIST_URL = "https://interreg.gov.pl/lista-projektow/"
LICENSE = ("Wykaz operacji publikowany obowiązkowo (art. 49 ust. 3 rozporządzenia (UE) 2021/1060) przez interreg.gov.pl; "
           "ponowne wykorzystanie jak dla informacji sektora publicznego (ustawa o otwartych danych). Warunki do potwierdzenia.")
VOIVODESHIP = REGION["name"].upper()  # w wykazie „PODKARPACKIE” — porównujemy początek nazwy
COLUMNS = {  # nagłówek w wykazie (początek) → pole
    "Program": "program", "Numer projektu": "number", "Tytul projektu": "title", "Opis projektu": "description",
    "Data rozpoczęcia": "start", "Nazwa partnera wiodącego/": "lead", "Województwo": "voivodeship", "Powiat": "powiat",
    "Gmina": "gmina", "Miejscowość": "city", "Zakres interwencji": "field",
}


def download() -> Path:
    folder = DOWNLOADS / "interreg"
    folder.mkdir(parents=True, exist_ok=True)
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=60, follow_redirects=True) as client:
        page = client.get(LIST_URL)
        page.raise_for_status()
        links = re.findall(r'href="([^"]+Wykaz_projektow_Interreg[^"]+\.xlsx)"', page.text)
        if not links:
            sys.exit("Na stronie listy nie ma linku do wykazu XLSX — sprawdź interreg.gov.pl/lista-projektow/")
        url = links[0] if links[0].startswith("http") else f"https://interreg.gov.pl{links[0]}"
        target = folder / url.rsplit("/", 1)[-1]
        target.write_bytes(client.get(url).raise_for_status().content)
        print(f"Pobrano {url}")
        return target


def latest_download() -> Path:
    files = sorted((DOWNLOADS / "interreg").glob("*.xlsx"))
    if not files:
        sys.exit("Brak pobranego wykazu — uruchom bez --offline")
    return files[-1]


def rows(path: Path):
    sheet = openpyxl.load_workbook(path, read_only=True).worksheets[0]
    header: dict[int, str] | None = None
    for row in sheet.iter_rows(values_only=True):
        cells = [str(c).strip() if c is not None else "" for c in row]
        if header is None:
            found = {i: field for i, c in enumerate(cells) for prefix, field in COLUMNS.items() if c.startswith(prefix)}
            if "number" in found.values() and "lead" in found.values():
                header = found
            continue
        if any(cells):
            yield {field: cells[i] if i < len(cells) else "" for i, field in header.items()}


def main() -> None:
    path = latest_download() if "--offline" in sys.argv else download()
    records, skipped = [], 0
    for r in rows(path):
        if not r.get("voivodeship", "").upper().startswith(VOIVODESHIP[:8]):
            continue
        lead = r["lead"].split("/")[0].strip()  # „Gmina Kęty/Obec Kęty” → nazwa polska
        teryt = teryt_for(r.get("gmina"), r.get("powiat"), r.get("city"), rural=rural_by_name(lead))
        if not is_regional_public(lead, teryt, TERYT_PREFIX):
            skipped += 1
            continue
        title = r["title"].split("/")[0].strip() or r["title"]
        records.append(normalize({
            "source": "interreg", "external_id": r["number"], "kind": "projekt", "title": title,
            "abstract": r.get("description"), "institution": lead, "institution_type": institution_type(lead), "teryt": teryt,
            "published_on": r.get("start"), "url": LIST_URL, "license": LICENSE,
            "keywords": [r.get("program", "").split("/")[0].replace("Program ", "").strip()],
        }))
    print(f"Pominięte (podmiot niepubliczny albo spoza regionu): {skipped}")
    save_snapshot("interreg", records, real=True, license=LICENSE,
                  note=f"Projekty Interreg 2021–2027 z partnerem wiodącym — instytucją publiczną z regionu. Plik: {path.name}.")


if __name__ == "__main__":
    main()
