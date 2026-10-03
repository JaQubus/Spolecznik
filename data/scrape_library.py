"""Scraper Biblioteki Innowacji Społecznych (README, sekcja 8.1).

rops.krakow.pl blokuje zwykłe żądania HTTP, więc używamy Playwright z prawdziwym Chromium:
1. Przejdź 9 stron kategorii, zbierz linki …/biblioteka-innowacji-spolecznych/{kategoria},{slug}.
2. Na każdej stronie weź tytuł i sekcje 1–4 według nagłówków, linki do PDF i osadzone wideo.
3. Zapisz surowy HTML do raw/library/ i JSON do out/innovations.json.
Każdy URL odwiedzamy raz, z przerwą 2–3 s.

Uruchomienie: uv run playwright install chromium && uv run scrape_library.py"""
from common import OUT, RAW  # noqa: F401


def main() -> None:
    raise NotImplementedError("TODO: scrape_library.py")


if __name__ == "__main__":
    main()
