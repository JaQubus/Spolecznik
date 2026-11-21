"""Wskaźniki mapy regionu: kategorie i opis każdego wskaźnika prostym językiem.

Kategorie (klucze) muszą się zgadzać z MAP_CATEGORIES w components/knowledge/map-categories.ts — tam są nazwy i ikony.
Wszystko z GUS BDL. Gminy: bazowe trzy z bdl.py i dodatkowe z bdl_wskazniki.py. Powiaty: te same zmienne
(bdl_wskazniki.py --level powiat) plus bazowe trzy z POWIAT_BASE.
`scale`: sequential (więcej = ciemniej) albo diverging (wartości na plus i na minus wokół zera).
"""
import re

CATEGORIES = ["ludnosc", "seniorzy", "pomoc", "placowki", "rodzina", "praca", "edukacja", "zdrowie", "kultura",
              "finanse", "otoczenie"]


# Dziedzina Radaru (config/taxonomy.json) dla kategorii — link „Zobacz inicjatywy i rozwiązania” przy wskaźniku.
CATEGORY_DOMAIN = {"seniorzy": "uslugi_spoleczne", "pomoc": "uslugi_spoleczne", "placowki": "uslugi_spoleczne",
                   "rodzina": "uslugi_spoleczne", "praca": "gospodarka", "edukacja": "edukacja", "zdrowie": "zdrowie",
                   "kultura": "kultura", "finanse": "administracja", "otoczenie": "srodowisko"}


def ind(key, label, unit, decimals, category, question=None, scale="sequential"):
    return dict(key=key, label=label, unit=unit, decimals=decimals, scale=scale, domain=CATEGORY_DOMAIN.get(category),
                category=category, question=question)


GMINA_INDICATORS = [
    ind("ludnosc", "Liczba mieszkańców", "osób", 0, "ludnosc", "Ile osób mieszka w gminie?"),
    ind("zmiana_ludnosci_10l", "Zmiana liczby mieszkańców w 10 lat", "%", 1, "ludnosc",
        "Czy mieszkańców przybywa, czy ubywa? Ujemna liczba to spadek.", scale="diverging"),
    ind("udzial_65plus", "Osoby w wieku 65+", "%", 1, "seniorzy", "Jaka część mieszkańców ma 65 lat lub więcej?"),
]


# Bazowe wskaźniki powiatu, liczone w bdl_wskazniki.py --level powiat (pozostałe: te same zmienne BDL co dla gmin).
POWIAT_BASE = [
    ind("ludnosc", "Liczba mieszkańców", "osób", 0, "ludnosc", "Ile osób mieszka w powiecie?"),
    ind("zmiana_ludnosci_10l", "Zmiana liczby mieszkańców w 10 lat", "%", 1, "ludnosc",
        "Czy mieszkańców przybywa, czy ubywa? Ujemna liczba to spadek.", scale="diverging"),
    ind("udzial_65plus", "Osoby w wieku 65+", "%", 1, "seniorzy", "Jaka część mieszkańców ma 65 lat lub więcej?"),
]


def check(indicators: list[dict]) -> None:
    keys = [i["key"] for i in indicators]
    dupes = {k for k in keys if keys.count(k) > 1}
    assert not dupes, f"Powtórzone klucze wskaźników: {dupes}"
    for i in indicators:
        assert i["category"] in CATEGORIES, f"Nieznana kategoria {i['category']} ({i['key']})"
        assert re.fullmatch(r"[a-z0-9_]+", i["key"]), i["key"]
