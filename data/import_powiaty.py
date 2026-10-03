"""Import wskaźników powiatów do tabeli powiaty_wskazniki (migracja 0007).

Źródło: ../dane/powiaty/wszystkie_powiaty.csv (eksport IOSS: 22 powiaty × 112 wskaźników).
Pliki per powiat w tym samym katalogu to duplikaty — nie są czytane.

Porządki (mapowanie w powiaty_mapping.json):
- obcięte nazwy arkuszy XLS w kolumnie `kategoria` (np. „POMOC SPOŁECZNA - P”, „Sheet6”) → pełne nazwy,
- puste jednostki → jednostka z mapowania (np. „Stopa bezrobocia” → „%”).

Idempotentny: upsert po (powiat, wskaźnik, rok), a dla lat obecnych w pliku kasuje wiersze,
których w pliku już nie ma. Zawsze zapisuje oczyszczone dane do out/powiaty.json.

Uruchomienie:
  uv run import_powiaty.py            # do bazy z SUPABASE_DB_URL (../.env.local)
  uv run import_powiaty.py --sql      # zamiast tego out/powiaty.sql do wklejenia w SQL Editor Supabase
"""
import csv
import sys
import unicodedata
from pathlib import Path

from common import OUT, ROOT, read_json, write_json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

CSV_PATH = ROOT.parent / "dane" / "powiaty" / "wszystkie_powiaty.csv"
MAPPING = read_json(ROOT / "powiaty_mapping.json")


def powiat_id(nazwa: str) -> str:
    """„powiat m. Nowy Sącz” → „nowysacz”, „powiat bocheński” → „bochenski” (jak nazwy plików w dane/powiaty)."""
    s = nazwa.removeprefix("powiat ").removeprefix("m. ")
    s = s.replace("ł", "l").replace("Ł", "L")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return "".join(ch for ch in s.lower() if ch.isalnum())


def load_rows() -> list[dict]:
    categories, units = MAPPING["kategorie"], MAPPING["jednostki"]
    rows, warnings = [], set()
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            cat = categories.get(r["kategoria"])
            if cat is None:
                warnings.add(f"nieznana kategoria „{r['kategoria']}” — dopisz ją do powiaty_mapping.json")
                cat = r["kategoria"]
            unit = r["jednostka"].strip() or units.get(r["wskaznik"], "")
            if not unit:
                warnings.add(f"brak jednostki: „{r['wskaznik']}” — dopisz ją do powiaty_mapping.json")
            value = r["wartosc"].strip()
            rows.append({
                "powiat": powiat_id(r["powiat"]),
                "nazwa": r["powiat"].strip(),
                "kategoria": cat,
                "wskaznik": r["wskaznik"].strip(),
                "opis": r["opis"].strip() or None,
                "rok": int(r["rok"]),
                "wartosc": float(value) if value else None,
                "jednostka": unit,
            })

    keys = [(r["powiat"], r["wskaznik"], r["rok"]) for r in rows]
    if len(keys) != len(set(keys)):
        sys.exit("! zdublowane wiersze (powiat, wskaźnik, rok) w CSV")
    for w in sorted(warnings):
        print("!", w)
    return rows


def sql_literal(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


COLUMNS = ["powiat", "nazwa", "kategoria", "wskaznik", "opis", "rok", "wartosc", "jednostka"]
UPSERT = (
    f"insert into powiaty_wskazniki ({', '.join(COLUMNS)}) values ({{values}})\n"
    "on conflict (powiat, wskaznik, rok) do update set nazwa = excluded.nazwa, kategoria = excluded.kategoria,\n"
    "  opis = excluded.opis, wartosc = excluded.wartosc, jednostka = excluded.jednostka"
)


def write_sql(rows: list[dict], path: Path) -> None:
    years = sorted({r["rok"] for r in rows})
    lines = ["-- Wygenerowane przez data/import_powiaty.py --sql. Można uruchamiać wielokrotnie.", "begin;"]
    lines.append(f"delete from powiaty_wskazniki where rok in ({', '.join(map(str, years))});")
    values = ",\n".join("(" + ", ".join(sql_literal(r[c]) for c in COLUMNS) + ")" for r in rows)
    lines.append(UPSERT.replace("values ({values})", f"values\n{values}") + ";")
    lines.append("commit;")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def load_db(rows: list[dict]) -> None:
    from common import db_url

    try:
        database_url = db_url()
    except KeyError as error:
        raise SystemExit(
            "Brak SUPABASE_DB_URL w .env.local. "
            "Dodaj connection string do bazy albo uruchom: python import_powiaty.py --sql"
        ) from error

    import psycopg  # tylko tu: wariant --sql działa bez sterownika i bez bazy

    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        cur.executemany(UPSERT.format(values=", ".join(f"%({c})s" for c in COLUMNS)), rows)
        for year in sorted({r["rok"] for r in rows}):
            keep = [f"{r['powiat']}|{r['wskaznik']}" for r in rows if r["rok"] == year]
            cur.execute(
                "delete from powiaty_wskazniki where rok = %s and not (powiat || '|' || wskaznik = any(%s))",
                (year, keep),
            )
        cur.execute("select count(*), count(distinct powiat) from powiaty_wskazniki")
        total, powiaty = cur.fetchone()
    print(f"w bazie: {total} wierszy, {powiaty} powiatów")


def main() -> None:
    rows = load_rows()
    write_json(OUT / "powiaty.json", rows)
    n_powiaty = len({r["powiat"] for r in rows})
    n_wsk = len({r["wskaznik"] for r in rows})
    print(f"CSV: {len(rows)} wierszy, {n_powiaty} powiatów, {n_wsk} wskaźników → out/powiaty.json")
    if "--sql" in sys.argv:
        write_sql(rows, OUT / "powiaty.sql")
        print("→ out/powiaty.sql (wklej w Supabase → SQL Editor po migracji 0007)")
    else:
        load_db(rows)


if __name__ == "__main__":
    main()
