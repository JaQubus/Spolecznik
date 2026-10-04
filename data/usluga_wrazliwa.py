"""Ramowe Plany Wdrożenia z naborów ROPS „Usługa Wrażliwa” (#105).

ROPS publikuje dla każdej innowacji z naboru „Ramowy Plan Wdrożenia”: czego nie można zgubić, mapę wdrożenia,
co jest obowiązkowe i checklistę dla grantobiorcy. Pobieramy PDF-y raz (raw/usluga_wrazliwa/) i wyciągamy
trzy sekcje, które idą jako kontekst do planu wdrożenia (/api/middleman) i oceny wniosku (/api/wniosek-uw/ocena).

Wynik: out/usluga_wrazliwa.json — po slugu innowacji z Biblioteki: nabór, link do PDF-a i sekcje.
Nowy nabór: dopisz innowacje do NABORY i uruchom ponownie.

Uruchomienie: uv run usluga_wrazliwa.py"""
import re

import httpx
import pymupdf

from common import OUT, RAW, write_json

BASE = "https://rops.krakow.pl/pliki-do-pobrania/artykul,"
DIR = RAW / "usluga_wrazliwa"

# slug w Bibliotece → plik na rops.krakow.pl (strony naborów: I – IS-430-3/25, II – IS-430-6/26)
NABORY = {
    "I": {
        "bez-presji-z-depresji": "ramowy-plan-wdrozania-bez-presji-z-depresji,1351",
        "straznik": "ramowy-plan-wdrozania-straznik-alarm-ally,1352",
        "himalaje-autyzmu": "ramowy-plan-wdrozania-himalaje-autyzmu,1353",
        "rodzina-adopcyjna-dorasta": "ramowy-plan-wdrozenia-rodzina-adopcyjna-dorasta,1354",
        "gluchy-czytelnik-w-bibliotece": "ramowy-plan-wdrozania-gluchy-czytelnik-w-bibliotece,1361",
    },
    "II": {
        "przenosne-modularne-lazienki": "ramowy-plan-wdrozenia-przenosne-modularne-lazienki,1460",
        "komix-zyciowy": "ramowy-plan-wdrozenia-komix-zyciowy,1459",
        "organizator-kompleksowej-opieki-w-miejscu-zamieszkania":
            "ramowy-plan-wdrozenia-organizator-kompleksowej-opieki-w-miejscu-zamieszkania,1458",
        "szlakiem-ludzi-bezdomnych": "ramowy-plan-wdrozenia-szlakiem-ludzi-bezdomnych,1457",
        "terapeuta-przestrzeni": "ramowy-plan-wdrozenia-terapeuta-przestrzeni,1456",
    },
}

# Nagłówki wskazówek dla grantobiorcy. Plany z I i II naboru mają inny układ, więc każda sekcja ma oba warianty
# (II: „czego nie można zgubić”, „co jest obowiązkowe”, „checklista”; I: „istota i wyróżniki”, „co warto uzupełnić”,
# „rzeczy, których instytucje powinny unikać”). Numeracja bywa arabska albo rzymska z tytułem w nowej linii.
SECTIONS = {
    "essence": r"(czego\s+nie\s+mo[żz]na\s+zgubi[ćc]|istota\s+i\s+wyr[óo][żz]niki)",
    "mandatory": r"(co\s+jest\s+obowi[ąa]zkowe|co\s+warto\s+uzupe[łl]ni[ćc])",
    "checklist": r"((szybka\s+)?checklista|rzeczy,\s+kt[óo]rych\s+instytucje\s+powinny\s+unika[ćc])",
}
HEADING = r"\n\s*(?:\d{1,2}|[IVX]{1,4})\.\s*\n?\s*"
NEXT_HEADING = re.compile(HEADING + r"[A-ZĄĆĘŁŃÓŚŹŻ][^\n]{3,90}\n")
MAX_CHARS = 4000


def download(slug: str, path: str) -> bytes:
    target = DIR / f"{slug}.pdf"
    if not target.exists():
        DIR.mkdir(parents=True, exist_ok=True)
        for attempt in range(3):  # serwer ROPS bywa wolny przy dużych PDF-ach
            try:
                r = httpx.get(BASE + path, follow_redirects=True, timeout=180)
                r.raise_for_status()
                break
            except httpx.TransportError:
                if attempt == 2:
                    raise
        if not r.content.startswith(b"%PDF"):
            raise RuntimeError(f"{slug}: to nie jest PDF ({r.headers.get('content-type')})")
        target.write_bytes(r.content)
    return target.read_bytes()


def clean(text: str) -> str:
    text = re.sub(r"\n\s*Strona \d+ z \d+\s*\n", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def section(text: str, pattern: str) -> str | None:
    """Treść od nagłówka pasującego do `pattern` (ostatnie wystąpienie: druga część planu) do następnego nagłówka."""
    hits = list(re.finditer(HEADING + rf"[^\n]*{pattern}[^\n]*\n", text, re.I))
    if not hits:
        return None
    start = hits[-1].end()
    end = NEXT_HEADING.search(text, start)
    body = text[start:end.start() if end else len(text)].strip()
    return body[:MAX_CHARS].rsplit("\n", 1)[0] if len(body) > MAX_CHARS else body


def main() -> None:
    result = {}
    for nabor, plans in NABORY.items():
        for slug, path in plans.items():
            with pymupdf.open(stream=download(slug, path), filetype="pdf") as pdf:
                text = clean("\n".join(page.get_text() for page in pdf))
            sections = {key: section(text, pattern) for key, pattern in SECTIONS.items()}
            missing = [k for k, v in sections.items() if not v]
            print(f"{nabor} {slug}: {len(text)} znaków" + (f", brak sekcji: {', '.join(missing)}" if missing else ""))
            result[slug] = {"call": nabor, "url": BASE + path, **sections}
    write_json(OUT / "usluga_wrazliwa.json", result)
    print(f"Zapisano out/usluga_wrazliwa.json: {len(result)} planów")


if __name__ == "__main__":
    main()
