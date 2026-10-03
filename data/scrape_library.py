"""Scraper Biblioteki Innowacji Społecznych (README, sekcja 8.1).

rops.krakow.pl blokuje zwykłe żądania HTTP, więc używamy Playwright z prawdziwym Chromium:
1. Przejdź 9 stron kategorii, zbierz linki …/biblioteka-innowacji-spolecznych/{kategoria},{slug}.
2. Na każdej stronie weź tytuł i sekcje 1–5 według nagłówków, linki do PDF i osadzone wideo.
   Sekcję „Autorzy” pomijamy — to dane osobowe.
3. Zapisz surowy HTML do raw/library/ i JSON do out/innovations.json.
Każdy URL odwiedzamy raz, z przerwą 2–3 s. Ponowne uruchomienie korzysta z zapisanego HTML-a.

Domyślnie: uv run scrape_library.py  → fikcyjne innowacje z ../dane/mock (synthetic=true).
Prawdziwa Biblioteka (tylko na wyraźną decyzję zespołu):
  uv run playwright install chromium && uv run scrape_library.py --live [--no-pdf]"""
import random
import re
import sys
import time
from urllib.parse import urljoin

from common import OUT, RAW, ROOT, read_json, write_json

BASE = "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/"
LIB_RAW = RAW / "library"
PDF_RAW = LIB_RAW / "pdf"

# slug kategorii w URL-u → klucz osi 2 (GROUPS w lib/schemas.ts) i etykieta
CATEGORIES = {
    "dla-seniorow": ("seniorzy", "Dla seniorów"),
    "dla-dzieci-mlodziezy-i-rodziny": ("dzieci_mlodziez_rodzina", "Dla dzieci, młodzieży i rodziny"),
    "dla-osob-o-ograniczonej-mobilnosci": ("ograniczona_mobilnosc", "Dla osób o ograniczonej mobilności"),
    "dla-osob-z-niepelnosprawnoscia-sensoryczna": ("niepelnosprawnosc_sensoryczna", "Dla osób z niepełnosprawnością sensoryczną"),
    "dla-zdrowia-i-medycyny": ("zdrowie_medycyna", "Dla zdrowia i medycyny"),
    "dla-rynku-pracy": ("rynek_pracy", "Dla rynku pracy"),
    "dla-cudzoziemcow": ("cudzoziemcy", "Dla cudzoziemców"),
    "dla-osob-w-kryzysie-bezdomnosci": ("bezdomnosc", "Dla osób w kryzysie bezdomności"),
    "dla-osob-z-niepelnosprawnoscia-intelektualna": ("niepelnosprawnosc_intelektualna", "Dla osób z niepełnosprawnością intelektualną"),
}
LABEL_TO_GROUP = {label: key for key, label in CATEGORIES.values()}

# Numer sekcji na stronie → pole w innovations (nagłówki bywają różnie sformułowane, numer jest stały)
SECTIONS = {"1": "solution", "2": "problem", "3": "target_group", "4": "who_can_implement", "5": "evidence"}

# Wyciąga treść w przeglądarce: sekcje po <h4>, linki, odznakę upowszechniania.
EXTRACT_JS = """() => {
  const root = document.querySelector('.content__main .text-content') || document.querySelector('.text-content');
  const title = (document.querySelector('h2.page-title')?.innerText || '').trim();
  if (!root) return { title, sections: {}, links: [], badge: null };
  const sections = {};
  let current = null;
  for (const el of root.children) {
    if (/^H[3-5]$/.test(el.tagName)) { current = el.innerText.trim(); sections[current] = []; continue; }
    if (current && el.tagName !== 'TABLE') {
      const t = el.innerText.trim();
      if (t) sections[current].push(t);
    }
  }
  const links = [...root.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
  const strong = root.querySelector('p strong');
  const badge = strong && /UPOWSZECHNIANI/i.test(strong.innerText) ? strong.innerText.trim() : null;
  return { title, sections, links, badge };
}"""


def polite_sleep() -> None:
    time.sleep(random.uniform(2.0, 3.0))


def clean(text: str) -> str:
    return re.sub(r"[ \t ​]+", " ", text).strip()


def parse_detail(data: dict, url: str) -> dict:
    fields: dict[str, str | None] = {f: None for f in SECTIONS.values()}
    for heading, paragraphs in data["sections"].items():
        m = re.match(r"\s*(\d+)\s*\.", heading)
        if m and m.group(1) in SECTIONS:
            fields[SECTIONS[m.group(1)]] = clean("\n".join(paragraphs)) or None

    links = [urljoin(url, h) for h in data["links"] if h]
    pdfs = [h for h in links if h.lower().split("?")[0].endswith(".pdf")]
    videos = [h for h in links if re.search(r"youtube\.com|youtu\.be|vimeo\.com", h)]
    files = [h for h in links if re.search(r"\.(zip|docx?|pptx?)(\?|$)", h, re.I)]
    return {
        "title": clean(data["title"]),
        "dissemination_badge": data["badge"],
        **fields,
        "pdf_url": pdfs[0] if pdfs else None,
        "video_url": videos[0] if videos else None,
        "files": files,
    }


def scrape(download_pdfs: bool) -> list[dict]:
    from playwright.sync_api import sync_playwright

    LIB_RAW.mkdir(parents=True, exist_ok=True)
    PDF_RAW.mkdir(parents=True, exist_ok=True)
    by_slug: dict[str, dict] = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(locale="pl-PL")

        def fetch(url: str, cache_name: str) -> None:
            """Ładuje stronę z cache'u (raw/library) albo z sieci, raz."""
            cached = LIB_RAW / cache_name
            if cached.exists():
                page.set_content(cached.read_text(encoding="utf-8"))
                return
            polite_sleep()
            resp = page.goto(url, wait_until="domcontentloaded", timeout=60_000)
            if not resp or resp.status >= 400:
                raise RuntimeError(f"{url}: HTTP {resp.status if resp else '?'}")
            cached.write_text(page.content(), encoding="utf-8")

        # 1. Strony kategorii → linki do innowacji
        for cat_slug, (group, label) in CATEGORIES.items():
            fetch(BASE + cat_slug, f"_kategoria_{cat_slug}.html")
            hrefs = page.eval_on_selector_all(
                f"a[href*='{cat_slug},']", "els => els.map(a => a.getAttribute('href'))")
            slugs = sorted({h.split(",", 1)[1].split("?")[0].strip("/") for h in hrefs})
            print(f"{label}: {len(slugs)} innowacji", flush=True)
            for slug in slugs:
                entry = by_slug.setdefault(slug, {"slug": slug, "url": f"{BASE}{cat_slug},{slug}", "categories": []})
                if label not in entry["categories"]:
                    entry["categories"].append(label)

        # 2. Strony innowacji (każda raz, nawet jeśli jest w kilku kategoriach)
        for i, entry in enumerate(by_slug.values(), 1):
            try:
                fetch(entry["url"], f"{entry['slug']}.html")
                entry.update(parse_detail(page.evaluate(EXTRACT_JS), entry["url"]))
            except Exception as e:  # jedna zepsuta strona nie zatrzymuje całości
                print(f"  ! {entry['slug']}: {e}", flush=True)
                continue
            print(f"[{i}/{len(by_slug)}] {entry.get('title')}", flush=True)

            # 3. Karta PDF (do parse_pdfs.py), przez ten sam kontekst przeglądarki
            if download_pdfs and entry.get("pdf_url"):
                target = PDF_RAW / f"{entry['slug']}.pdf"
                if not target.exists():
                    polite_sleep()
                    try:
                        r = page.request.get(entry["pdf_url"], timeout=120_000)
                        if r.ok and r.body()[:4] == b"%PDF":
                            target.write_bytes(r.body())
                        else:
                            print(f"  ! PDF {entry['slug']}: HTTP {r.status}", flush=True)
                    except Exception as e:
                        print(f"  ! PDF {entry['slug']}: {e}", flush=True)

        browser.close()

    out = []
    for e in by_slug.values():
        if not e.get("title"):
            continue
        e["groups"] = [LABEL_TO_GROUP[c] for c in e["categories"]]
        e["synthetic"] = False
        out.append(e)
    return out


def from_mock() -> list[dict]:
    """Fikcyjne innowacje z ../dane/mock — ten sam kształt, oznaczone synthetic=true."""
    out = []
    for m in read_json(ROOT.parent / "dane" / "mock" / "innowacje_mock.json"):
        out.append({
            "slug": m["slug"],
            "url": m["url"],
            "title": m["title"],
            "categories": m["categories"],
            "groups": [LABEL_TO_GROUP[c] for c in m["categories"] if c in LABEL_TO_GROUP],
            "dissemination_badge": m.get("dissemination_badge"),
            "solution": m.get("solution"),
            "problem": m.get("problem"),
            "target_group": m.get("target_group"),
            "who_can_implement": m.get("who_can_implement"),
            "evidence": m.get("evidence"),
            "pdf_url": None,
            "video_url": None,
            "files": m.get("files", []),
            "synthetic": True,
        })
    return out


def main() -> None:
    innovations = scrape(download_pdfs="--no-pdf" not in sys.argv) if "--live" in sys.argv else from_mock()
    write_json(OUT / "innovations.json", innovations)
    empty = [i["slug"] for i in innovations if not i.get("solution")]
    print(f"Zapisano out/innovations.json: {len(innovations)} innowacji"
          + (f"; bez sekcji „Na czym polega”: {len(empty)} ({', '.join(empty[:5])}…)" if empty else ""))


if __name__ == "__main__":
    main()
