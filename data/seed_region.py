"""Gminy regionu do tabeli municipalities: out/gminy.json (bdl.py) → ../supabase/seed/10_municipalities.sql.

Plik seed idzie pierwszy, bo inicjatywy, wyzwania i adopcje wskazują gminę kluczem obcym.

    cd data && uv run seed_region.py"""
import sys

from common import OUT, SEED, Jsonb, read_json, upsert
from region import EXPECTED_GMINY, MIN_GMINY


def main() -> None:
    gminy = read_json(OUT / "gminy.json")
    if len(gminy) < MIN_GMINY:
        sys.exit(f"Za mało gmin w out/gminy.json: {len(gminy)} z {EXPECTED_GMINY} — uruchom bdl.py")
    lines = ["-- Wygenerowane przez data/seed_region.py z danych GUS (BDL) — nie edytuj ręcznie."]
    for g in gminy:
        lines.append(upsert("municipalities", "teryt", {
            "teryt": g["teryt"], "name": g["nazwa"], "county": g["powiat"], "kind": g["typ"],
            "population": g["ludnosc"], "share_65plus": g["udzial_65plus"],
            "population_change_10y": g["zmiana_ludnosci_10l"], "indicators": Jsonb(g.get("wskazniki") or {}),
        }))
    SEED.mkdir(parents=True, exist_ok=True)
    (SEED / "10_municipalities.sql").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"supabase/seed/10_municipalities.sql: {len(gminy)} gmin, {len({g['teryt'][:4] for g in gminy})} powiatów")


if __name__ == "__main__":
    main()
