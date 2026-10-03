"""Parsowanie PDF-ów (PyMuPDF), README sekcja 8.2.

- Karty PDF z Biblioteki → doklejenie „Skąd wiemy, że działa?”, „Jak skorzystać?”, „Składowe”.
- Mapa Wyzwań → out/taxonomy.json (8 obszarów, definicje, wyzwania).
- Canvas INNO AGH → out/canvas_schema.json.
- Raporty → fragmenty po ok. 800 tokenów z numerem strony → out/doc_chunks.json."""
from common import OUT, RAW  # noqa: F401


def main() -> None:
    raise NotImplementedError("TODO: parse_pdfs.py")


if __name__ == "__main__":
    main()
