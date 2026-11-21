"""Region i marka z ../config/brand.json — ten sam plik czyta aplikacja (lib/brand.ts).

Zmiana regionu = edycja config/brand.json i ponowne uruchomienie pipeline'u, bez szukania stałych w skryptach."""
import json

from common import ROOT

BRAND = json.loads((ROOT.parent / "config" / "brand.json").read_text(encoding="utf-8"))
REGION = BRAND["region"]

TERYT_PREFIX: str = REGION["terytPrefix"]          # kod województwa, np. "12"
BDL_UNIT: str = REGION["bdlUnitId"]                # ID województwa w BDL (≠ TERYT)
EXPECTED_GMINY: int = REGION["expectedMunicipalities"]
EXPECTED_POWIATY: int = REGION["expectedCounties"]
MAP_LABELS: dict[str, str] = REGION["mapLabels"]   # TERYT gminy → podpis na mapie
SPLITS: dict[str, str] = REGION["municipalitySplits"]  # nowa gmina → gmina, z której ją wydzielono
STATUS_PREFIX: str = BRAND["statusPrefix"]

# Progi kompletności danych: zmienna/mapa jest użyteczna, gdy ma dane dla większości jednostek.
MIN_GMINY = round(0.82 * EXPECTED_GMINY)
MIN_POWIATY = round(0.9 * EXPECTED_POWIATY)
