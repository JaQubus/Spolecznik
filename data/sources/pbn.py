"""Polska Bibliografia Naukowa: publikacje z afiliacją uczelni publicznych regionu. MIGAWKA PRZYKŁADOWA.

API PBN (pbn.nauka.gov.pl/api) wymaga tokenu aplikacji wydawanego instytucjom; bez niego zwraca 403 (sprawdzone
21.11.2026). Z tokenem importer da się dopisać na tym samym formacie: tytuł, abstrakt, afiliacja, DOI.
Nazwiska autorów nie trafiają do migawki (normalize usuwa pole authors).

    cd data && uv run sources/pbn.py
"""
from base import save_synthetic

RECORDS = [
    dict(external_id="PRZYKLAD-PBN-001", kind="publikacja", institution="Politechnika Rzeszowska", published_on="2025-09-01",
         title="Właściwości mechaniczne kompozytów z recyklatu włókna węglowego do zastosowań w lotnictwie",
         abstract="Zbadano wytrzymałość na rozciąganie i zginanie próbek wytworzonych z rozdrobnionych odpadów kompozytu "
                  "węglowo-epoksydowego. Wyniki wskazują na możliwość zastosowania recyklatu w drugorzędnych elementach nośnych.",
         authors=["Jan Przykładowy", "Anna Przykładowa"],
         keywords=["kompozyt", "włókno węglowe", "recykling", "wytrzymałość", "lotnictwo"]),
    dict(external_id="PRZYKLAD-PBN-002", kind="publikacja", institution="Uniwersytet Rzeszowski", published_on="2026-02-10",
         title="Gra komputerowa z czujnikiem ruchu w domowej rehabilitacji kończyny górnej po udarze — badanie pilotażowe",
         abstract="W badaniu na 30 pacjentach porównano częstość ćwiczeń z grą i z kartą ćwiczeń. Grupa z grą ćwiczyła czterokrotnie częściej.",
         keywords=["rehabilitacja", "udar", "gra", "czujnik ruchu"]),
    dict(external_id="PRZYKLAD-PBN-003", kind="publikacja", institution="Państwowa Akademia Nauk Stosowanych w Krośnie", published_on="2025-12-05",
         title="Tanie czujniki pyłu zawieszonego w monitoringu jakości powietrza małych gmin",
         abstract="Porównanie odczytów sieci 24 tanich czujników z referencyjną stacją pomiarową i propozycja kalibracji.",
         keywords=["jakość powietrza", "smog", "czujnik", "gmina"]),
    dict(external_id="PRZYKLAD-PBN-004", kind="publikacja", institution="Uniwersytet Rzeszowski", published_on="2025-04-18",
         title="O pewnych własnościach geometrycznych przestrzeni Banacha",
         abstract="Praca dowodzi twierdzenia o charakteryzacji jednostajnej wypukłości w klasie przestrzeni Orlicza.",
         keywords=["przestrzeń Banacha", "analiza funkcjonalna", "matematyka"]),
]

if __name__ == "__main__":
    save_synthetic("pbn", RECORDS, "API PBN wymaga tokenu aplikacji (403 bez niego).")
