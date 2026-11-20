"""Karty faktów „{region} w liczbach” do Zasobnika wiedzy — liczone wprost z danych GUS (BDL), bez LLM.

Zasady (brief modułu II):
- Żadnych liczb z LLM. Każdy fakt pochodzi z out/gminy.json (bdl.py) albo out/powiaty_wskazniki.json
  (bdl_wskazniki.py --level powiat), a `quote` mówi, z której zmiennej BDL, ilu jednostek i z którego roku.
- Dla wskaźników względnych podajemy najniższą i najwyższą wartość wśród powiatów — bez liczenia średnich
  dla województwa, których GUS w tej postaci nie publikuje. Sumujemy tylko liczby osób (ludność gmin).
- Zdania piszemy szablonem prostym językiem. Liczby w zdaniu = liczby w danych.

    cd data && uv run knowledge_facts.py   →  out/knowledge/facts.json"""
import json
import sys

from common import DOMAINS, OUT, check_keys, write_json
from region import EXPECTED_POWIATY, MIN_POWIATY, REGION

BDL = {
    "source_title": "Bank Danych Lokalnych",
    "source_publisher": "Główny Urząd Statystyczny",
    "source_url": "https://bdl.stat.gov.pl/",
}

# Wskaźnik powiatów (klucz z out/powiaty_wskazniki.json) → fakt „od … do …”. domain: klucz z config/taxonomy.json.
RANGE_FACTS = [
    dict(domain="uslugi_spoleczne", key="udzial_65plus",
         sentence="Tyle mieszkańców ma 65 lat lub więcej — zależnie od powiatu. Najmniej: {min_where} ({min}). Najwięcej: {max_where} ({max})."),
    dict(domain="uslugi_spoleczne", key="beneficjenci",
         sentence="Tyle osób na 10 tysięcy mieszkańców korzysta z pomocy społecznej — zależnie od powiatu. Najmniej: {min_where} ({min}). Najwięcej: {max_where} ({max})."),
    dict(domain="edukacja", key="zlobki",
         sentence="Tyle dzieci do lat 3 na 1000 chodzi do żłobka albo klubu dziecięcego — zależnie od powiatu. Najmniej: {min_where} ({min}). Najwięcej: {max_where} ({max})."),
    dict(domain="edukacja", key="przedszkola",
         sentence="Taka część dzieci w wieku 3–5 lat chodzi do przedszkola — zależnie od powiatu. Najmniej: {min_where} ({min}). Najwięcej: {max_where} ({max})."),
    dict(domain="zdrowie", key="przychodnie",
         sentence="Tyle przychodni przypada na 10 tysięcy mieszkańców — zależnie od powiatu. Najmniej: {min_where} ({min}). Najwięcej: {max_where} ({max})."),
]


def pl_number(x: float, decimals: int = 1) -> str:
    s = f"{x:,.{decimals}f}".replace(",", " ").replace(".", ",")
    return s.rstrip("0").rstrip(",") if "," in s else s


def with_unit(x: float, ind: dict) -> str:
    v = pl_number(x, ind["decimals"])
    return f"{v}%" if ind["unit"] == "%" else f"{v} {ind['unit']}"


def powiat_label(teryt4: str, gminy: list[dict]) -> str:
    name = next(g["powiat"] for g in gminy if g["teryt"].startswith(teryt4))
    return f"{name.removeprefix('m. ')} (miasto)" if name.startswith("m. ") else f"powiat {name}"


def region_facts(gminy: list[dict]) -> list[dict]:
    """Fakty o całym regionie z profili gmin: liczby osób, które da się zsumować."""
    year = max(g["wskazniki"].get("rok", 0) for g in gminy)
    total = sum(g["ludnosc"] for g in gminy if g["ludnosc"])
    seniors = sum(g["ludnosc"] * g["udzial_65plus"] / 100 for g in gminy if g["ludnosc"] and g["udzial_65plus"])
    shrinking = [g for g in gminy if (g["zmiana_ludnosci_10l"] or 0) < 0]
    loc = REGION["locative"]
    return [
        {
            "domain": "uslugi_spoleczne", "value": round(seniors / 1000, 1), "unit": "tys. osób",
            "display_value": f"{pl_number(seniors / 1000)} tys.", "data_year": year,
            "sentence": f"Tyle osób {loc} ma 65 lat lub więcej. To {pl_number(100 * seniors / total)} na 100 mieszkańców.",
            "quote": f"Suma po {len(gminy)} gminach: ludność ogółem (zmienna 72305) i w wieku 65+ (72239, 72240), {year} r.",
        },
        {
            "domain": "administracja", "value": len(shrinking), "unit": "gmin", "display_value": f"{len(shrinking)} z {len(gminy)}",
            "data_year": year,
            "sentence": f"W tylu gminach {loc} ubyło mieszkańców w ciągu 10 lat.",
            "quote": f"Zmiana ludności ogółem (zmienna 72305) {year - 10}–{year}, {len(gminy)} gmin.",
        },
    ]


def range_facts(gminy: list[dict]) -> list[dict]:
    data = json.loads((OUT / "powiaty_wskazniki.json").read_text(encoding="utf-8"))
    by_key = {i["key"]: i for i in data["indicators"]}
    out = []
    for f in RANGE_FACTS:
        ind = by_key.get(f["key"])
        if not ind:
            print(f"! pomijam fakt {f['key']}: brak wskaźnika w out/powiaty_wskazniki.json", file=sys.stderr)
            continue
        values = [(code, v[f["key"]]) for code, v in data["values"].items() if v.get(f["key"]) is not None]
        if len(values) < MIN_POWIATY:
            sys.exit(f"Za mało powiatów dla wskaźnika {f['key']}: {len(values)} z {EXPECTED_POWIATY}")
        lo, hi = min(values, key=lambda v: v[1]), max(values, key=lambda v: v[1])
        out.append({
            "domain": f["domain"], "value": None, "unit": ind["unit"],
            "display_value": f"od {with_unit(lo[1], ind)} do {with_unit(hi[1], ind)}",
            "data_year": ind["year"],
            "sentence": f["sentence"].format(min=with_unit(lo[1], ind), max=with_unit(hi[1], ind),
                                             min_where=powiat_label(lo[0], gminy), max_where=powiat_label(hi[0], gminy)),
            "quote": f"{ind['label']} (zmienna BDL {ind.get('bdl', '—')}), {len(values)} powiatów i miast na prawach powiatu, {ind['year']} r.",
        })
    return out


def main() -> None:
    gminy = json.loads((OUT / "gminy.json").read_text(encoding="utf-8"))
    facts = [
        {**f, **BDL, "source_year": f["data_year"], "source_page": None, "is_example": False,
         "verified": "policzone skryptem z danych BDL"}
        for f in region_facts(gminy) + range_facts(gminy)
    ]
    check_keys("domains", [f["domain"] for f in facts], DOMAINS)
    write_json(OUT / "knowledge" / "facts.json", facts)
    by_domain: dict[str, int] = {}
    for f in facts:
        by_domain[f["domain"]] = by_domain.get(f["domain"], 0) + 1
    print(f"{len(facts)} faktów: {by_domain}", file=sys.stderr)


if __name__ == "__main__":
    main()
