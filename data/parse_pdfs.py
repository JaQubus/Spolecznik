"""Parsowanie PDF-ów (PyMuPDF), README sekcja 8.2.

Wejście: PDF-y wrzucone ręcznie do raw/docs/ (raporty ROPS, Mapa Wyzwań, Canvas INNO AGH)
oraz — tylko po scrape_library.py --live — karty innowacji w raw/library/pdf/.

- Karty PDF z Biblioteki → out/pdf_sections.json („Skąd wiemy, że działa?”, „Jak skorzystać?”, „Składowe”).
- Mapa Wyzwań (nazwa pliku zawiera „Mapa_Wyzwa”) → out/taxonomy.json (8 obszarów, definicje, wyzwania).
- Canvas INNO AGH (nazwa zawiera „CANVAS”) → out/canvas_schema.json.
- Pozostałe → fragmenty po ok. 800 tokenów z numerem strony → out/doc_chunks.json.

Uruchomienie: uv run parse_pdfs.py"""
import re
from pathlib import Path

import pymupdf

from common import AREAS, OUT, RAW, read_json, write_json

DOCS = RAW / "docs"
LIBRARY_PDF = RAW / "library" / "pdf"

CHUNK_CHARS = 3200      # ~800 tokenów polskiego tekstu
CHUNK_OVERLAP = 300

# Pliki, które nie są raportami (formularze, wzory) — nie trafiają do RAG.
SKIP_RAG = re.compile(r"formularz|wzor|canvas|mapa_wyzwa", re.I)

LIBRARY_SECTIONS = {
    "evidence": r"sk[aą]d\s+wiemy,?\s+[zż]e\s+dzia[lł]a",
    "how_to_use": r"jak\s+skorzysta[cć]",
    "components": r"sk[lł]adowe(\s+innowacji)?",
}

# Domyślny canvas — używany, gdy nie ma PDF-a; pola admin może zmienić bez kodu (README §2).
DEFAULT_CANVAS = [
    ("problem", "Problem", "Jaki problem społeczny rozwiązujesz? Kogo dotyczy i jak bardzo?"),
    ("odbiorcy", "Odbiorcy", "Kto skorzysta? Opisz grupę i jej potrzeby."),
    ("rozwiazanie", "Rozwiązanie", "Na czym polega Twój pomysł?"),
    ("wartosc", "Wartość dla odbiorców", "Co zmieni się w życiu odbiorców?"),
    ("innowacyjnosc", "Co jest nowego", "Czym różni się od tego, co już jest?"),
    ("partnerzy", "Partnerzy", "Kto pomoże we wdrożeniu (OPS, NGO, szkoła, firma)?"),
    ("zasoby", "Zasoby", "Ludzie, miejsce, sprzęt, wiedza."),
    ("koszty", "Koszty i finansowanie", "Ile to kosztuje i skąd pieniądze?"),
    ("wskazniki", "Jak zmierzysz efekt", "Po czym poznasz, że działa?"),
    ("ryzyka", "Ryzyka", "Co może pójść nie tak?"),
]


def page_texts(path: Path) -> list[str]:
    with pymupdf.open(path) as doc:
        return [p.get_text("text") for p in doc]


def normalize(text: str) -> str:
    text = re.sub(r"-\n(?=\w)", "", text)          # dzielenie wyrazów na końcu linii
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def doc_meta(path: Path) -> tuple[str, int | None]:
    """„2024 _ Piecza zastępcza w Małopolsce.pdf” → („Piecza zastępcza w Małopolsce”, 2024)."""
    m = re.match(r"\s*((?:19|20)\d{2})\s*[_I|-]\s*(.+)", path.stem)
    if m:
        return m.group(2).strip(), int(m.group(1))
    return path.stem.replace("_", " ").strip(), None


def chunk_pages(pages: list[str]) -> list[tuple[int, str]]:
    """Fragmenty ~800 tokenów; numer strony = strona, na której fragment się zaczyna."""
    chunks: list[tuple[int, str]] = []
    for page_no, raw in enumerate(pages, 1):
        text = normalize(raw)
        if len(text) < 80:  # okładki, puste strony, same numery
            continue
        start = 0
        while start < len(text):
            end = min(start + CHUNK_CHARS, len(text))
            if end < len(text):  # tniemy na granicy akapitu albo zdania
                cut = max(text.rfind("\n\n", start, end), text.rfind(". ", start, end))
                if cut > start + CHUNK_CHARS // 2:
                    end = cut + 1
            chunks.append((page_no, text[start:end].strip()))
            if end >= len(text):
                break
            start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


def split_sections(text: str, patterns: dict[str, str]) -> dict[str, str]:
    """Tekst między kolejnymi nagłówkami z `patterns` (w dowolnej kolejności w dokumencie)."""
    hits = []
    for key, pat in patterns.items():
        m = re.search(rf"(?im)^\s*(?:\d+\.\s*)?{pat}\s*\??\s*$", text) or re.search(rf"(?i){pat}\s*\??", text)
        if m:
            hits.append((m.start(), m.end(), key))
    hits.sort()
    out = {}
    for n, (_, end, key) in enumerate(hits):
        stop = hits[n + 1][0] if n + 1 < len(hits) else len(text)
        body = normalize(text[end:stop])
        if body:
            out[key] = body[:4000]
    return out


def parse_library_cards() -> None:
    # Tylko karty innowacji z aktualnego korpusu — w trybie mock żadna karta nie pasuje.
    slugs = {i["slug"] for i in read_json(OUT / "innovations.json")} if (OUT / "innovations.json").exists() else set()
    pdfs = sorted(p for p in LIBRARY_PDF.glob("*.pdf") if p.stem in slugs) if LIBRARY_PDF.exists() else []
    if not pdfs:
        write_json(OUT / "pdf_sections.json", {})
        print("Brak kart PDF dla innowacji z out/innovations.json — pomijam (tryb mock)")
        return
    sections = {}
    for pdf in pdfs:
        found = split_sections("\n".join(page_texts(pdf)), LIBRARY_SECTIONS)
        if found:
            sections[pdf.stem] = found
    write_json(OUT / "pdf_sections.json", sections)
    print(f"Karty Biblioteki: {len(sections)}/{len(pdfs)} z rozpoznanymi sekcjami → out/pdf_sections.json")


def parse_taxonomy(pdf: Path | None) -> None:
    taxonomy = {key: {"label": label, "definition": None, "challenges": []} for key, label in AREAS.items()}
    if pdf:
        text = normalize("\n".join(page_texts(pdf)))
        # Nagłówek obszaru = linia zaczynająca się od jego nazwy (np. „Bezdomność”, „Seniorzy”).
        patterns = {key: re.escape(label.split(" i ")[0]) for key, label in AREAS.items()}
        for key, body in split_sections(text, patterns).items():
            paras = [p.strip() for p in body.split("\n\n") if p.strip()]
            taxonomy[key]["definition"] = paras[0][:1500] if paras else None
            bullets = re.findall(r"(?m)^\s*(?:[•▪●\-–]|\d+[.)])\s*(.{10,200})$", body)
            taxonomy[key]["challenges"] = [b.strip() for b in bullets][:15]
        found = sum(1 for t in taxonomy.values() if t["definition"])
        print(f"Mapa Wyzwań: definicje dla {found}/8 obszarów — sprawdź ręcznie out/taxonomy.json")
    else:
        print("Brak Mapy Wyzwań w raw/docs — taxonomy.json tylko z etykietami")
    write_json(OUT / "taxonomy.json", taxonomy)


def parse_canvas(pdf: Path | None) -> None:
    schema = {
        "source": pdf.name if pdf else "domyślny",
        "fields": [{"key": k, "label": label, "hint": hint, "type": "textarea"} for k, label, hint in DEFAULT_CANVAS],
    }
    if pdf:
        # Etykiety pól na planszy to krótkie napisy dużą/pogrubioną czcionką — zbieramy je do przeglądu.
        labels = []
        with pymupdf.open(pdf) as doc:
            for page in doc:
                for block in page.get_text("dict")["blocks"]:
                    for line in block.get("lines", []):
                        for span in line["spans"]:
                            t = span["text"].strip()
                            if 3 <= len(t) <= 60 and (span["size"] >= 11 or span["flags"] & 16) and t not in labels:
                                labels.append(t)
        schema["source_labels"] = labels  # do ręcznego zmapowania na fields
        print(f"Canvas: {len(labels)} etykiet z PDF-a w source_labels — dopasuj fields ręcznie")
    write_json(OUT / "canvas_schema.json", schema)


def parse_reports(pdfs: list[Path]) -> None:
    chunks = []
    for pdf in pdfs:
        title, year = doc_meta(pdf)
        try:
            pages = page_texts(pdf)
        except Exception as e:
            print(f"  ! {pdf.name}: {e}")
            continue
        doc_chunks = chunk_pages(pages)
        if not doc_chunks:
            print(f"  ? {pdf.name}: brak tekstu (skan? potrzebny OCR)")
            continue
        chunks += [{"doc_title": title, "year": year, "url": None, "file": pdf.name, "page": p, "text": t}
                   for p, t in doc_chunks]
        print(f"  {title} ({year or '—'}): {len(pages)} stron, {len(doc_chunks)} fragmentów")
    write_json(OUT / "doc_chunks.json", chunks)
    print(f"Raporty: {len(pdfs)} plików, {len(chunks)} fragmentów → out/doc_chunks.json")


def main() -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    docs = sorted(DOCS.glob("*.pdf"))
    mapa = next((p for p in docs if re.search(r"mapa_wyzwa", p.name, re.I)), None)
    canvas = next((p for p in docs if re.search(r"canvas", p.name, re.I)), None)

    parse_library_cards()
    parse_taxonomy(mapa)
    parse_canvas(canvas)
    parse_reports([p for p in docs if not SKIP_RAG.search(p.name)])


if __name__ == "__main__":
    main()
