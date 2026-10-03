"""Szybki seed innowacji do bazy deweloperskiej — bez embeddingów i bez kluczy API.

Dla kogo: ktoś, kto chce zobaczyć Bibliotekę lokalnie, zanim przejdzie cały pipeline
(enrich.py wymaga klucza Groq). Ładuje out/innovations.json
(domyślnie zbudowany przez scrape_library.py z ../dane/mock/innowacje_mock.json),
więc to wciąż jedno źródło danych: tabela innovations.

- Wszystko z mocka ma synthetic = true (pole „mock” w danych wejściowych).
- Upsert po slugu, nic nie kasuje — można uruchamiać wielokrotnie, a później embed.py
  nadpisze te same wiersze pełnymi danymi i doda wpisy w search_index.
- Bez search_index wyszukiwanie w „Opisz problem” nie znajdzie tych innowacji; Biblioteka działa.

Uruchomienie: uv run seed_innovations.py"""
import psycopg

from common import INNOVATION_UPSERT, OUT, db_url, innovation_row, read_json


def main() -> None:
    innovations = read_json(OUT / "innovations.json")
    enriched = read_json(OUT / "enriched.json") if (OUT / "enriched.json").exists() else {}
    pdf = read_json(OUT / "pdf_sections.json") if (OUT / "pdf_sections.json").exists() else {}

    with psycopg.connect(db_url()) as conn, conn.cursor() as cur:
        for i in innovations:
            cur.execute(INNOVATION_UPSERT, innovation_row(i, enriched.get(i["slug"], {}), pdf.get(i["slug"], {})))
        cur.execute("select count(*), count(*) filter (where synthetic) from innovations")
        total, synthetic = cur.fetchone()
    print(f"innowacje w bazie: {total} (syntetyczne/mock: {synthetic})")


if __name__ == "__main__":
    main()
