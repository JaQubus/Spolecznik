"""NCBR: projekty B+R z beneficjentem — uczelnią lub instytucją publiczną z regionu. MIGAWKA PRZYKŁADOWA.

„Wyszukiwarka sukcesów beneficjentów” NCBR działa w przeglądarce (gov.pl) i nie ma publicznego API ani eksportu
(sprawdzone 21.11.2026). Docelowo: wykaz projektów Funduszy Europejskich 2021–2027 (art. 49 CPR, jak w interreg.py)
przefiltrowany po instytucji pośredniczącej NCBR — ten sam format rekordu.

    cd data && uv run sources/ncbr.py
"""
from base import save_synthetic

RECORDS = [
    dict(external_id="PRZYKLAD-NCBR-001", kind="projekt", institution="Politechnika Rzeszowska", published_on="2025-03-01",
         title="Predykcyjne utrzymanie ruchu maszyn w małych zakładach z użyciem taniego czujnika drgań",
         abstract="Projekt rozwija model przewidujący zużycie łożysk na podstawie drgań i testuje go w trzech zakładach branży motoryzacyjnej.",
         keywords=["utrzymanie ruchu", "czujnik drgań", "awaria", "sztuczna inteligencja"]),
    dict(external_id="PRZYKLAD-NCBR-002", kind="projekt", institution="Politechnika Rzeszowska", published_on="2026-04-01",
         title="Lekkie ramy dronów inspekcyjnych z kompozytów z odzysku",
         abstract="Projekt łączy recykling odpadów włókna węglowego z produkcji lotniczej z projektowaniem ram dronów inspekcyjnych.",
         keywords=["dron", "kompozyt", "recykling", "włókno węglowe"]),
    dict(external_id="PRZYKLAD-NCBR-003", kind="projekt", institution="Uniwersytet Rzeszowski", published_on="2025-10-01",
         title="Platforma telerehabilitacji dla pacjentów po udarze z mniejszych miejscowości",
         abstract="Platforma łączy domowe ćwiczenia z czujnikiem ruchu i zdalny nadzór fizjoterapeuty poradni powiatowej.",
         keywords=["telerehabilitacja", "udar", "fizjoterapia", "telemedycyna"]),
]

if __name__ == "__main__":
    save_synthetic("ncbr", RECORDS, "Wyszukiwarka NCBR nie ma publicznego API ani eksportu.")
