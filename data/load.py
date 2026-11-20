"""Ładuje pliki ../supabase/seed/*.sql do bazy z SUPABASE_DB_URL — to samo, co robi lokalnie `supabase db reset`.

Wszystkie pliki w jednej transakcji, alfabetycznie (10 gminy → 20 wiedza → 30 dane demo): błąd w dowolnym
pliku cofa całość. Pliki są idempotentne (upsert, dane demo kasowane i wstawiane od nowa), więc skrypt można
uruchamiać wielokrotnie. Wymaga zastosowanych migracji (supabase db push).

Kolejność pipeline'u: bdl.py → seed_region.py → knowledge_facts.py → knowledge_seed.py → seed_initiatives.py → load.py

    cd data && uv run load.py            # wszystkie pliki
    cd data && uv run load.py 30_demo    # tylko pliki, których nazwa zawiera „30_demo”"""
import sys

import psycopg

from common import SEED, db_url

COUNTS = ["municipalities", "domains", "facts", "materials", "patterns", "mentors", "programs", "initiatives",
          "challenges", "adoptions", "search_index"]


def main() -> None:
    files = sorted(p for p in SEED.glob("*.sql") if all(a in p.name for a in sys.argv[1:]))
    if not files:
        sys.exit(f"Brak plików seed w {SEED} — uruchom najpierw skrypty z docstringu")
    with psycopg.connect(db_url()) as conn, conn.cursor() as cur:
        for p in files:
            cur.execute(p.read_text(encoding="utf-8"))
            print(f"✓ {p.name}")
        conn.commit()
        for table in COUNTS:
            cur.execute(f"select count(*) from {table}")
            print(f"  {table}: {cur.fetchone()[0]}")


if __name__ == "__main__":
    main()
