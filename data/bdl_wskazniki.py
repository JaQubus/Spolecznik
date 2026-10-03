"""Dodatkowe wskaźniki gmin z API BDL GUS do mapy Małopolski (obok bazowych z bdl.py).

Każdy wskaźnik to zmienna BDL (id) albo temat + słowa, po których szukamy zmiennej w temacie
(numery zmiennych w nowych tematach bywają zmieniane). Dla każdej zmiennej bierzemy najnowszy rok,
w którym są dane dla co najmniej 150 z 183 gmin; zmienne bez danych na poziomie gmin pomijamy z ostrzeżeniem.
Bez X-ClientId (BDL_CLIENT_ID w ../.env.local) limit to 1000 zapytań na 12 godzin — skrypt robi ich ok. 150.

Wynik: out/gminy_wskazniki.json — opisy wskaźników (dla knowledge_map.py) i wartości po TERYT.
    cd data && uv run bdl_wskazniki.py"""
import time

from bdl import GMINA_KINDS, MALOPOLSKIE, Bdl, bdl_to_teryt
from common import OUT, write_json
from map_indicators import ind

MIN_UNITS = 150

# (wskaźnik, zmienna BDL: id albo (temat, słowa w nazwie zmiennej))
GMINA_BDL = [
    # Ludność
    (ind("gestosc", "Gęstość zaludnienia", "osób na km²", 0, "ludnosc", "Ile osób mieszka na 1 km²?"), "60559"),
    (ind("obciazenie", "Obciążenie demograficzne", "na 100 osób w wieku produkcyjnym", 1, "ludnosc",
         "Ile dzieci i seniorów przypada na 100 osób w wieku pracy?"), "60563"),
    (ind("przyrost", "Przyrost naturalny", "na 1000 mieszkańców", 2, "ludnosc",
         "Czy urodzeń jest więcej niż zgonów? Ujemna liczba: więcej zgonów.", scale="diverging"), "450551"),
    (ind("urodzenia", "Urodzenia", "na 1000 mieszkańców", 2, "ludnosc", "Ile dzieci rodzi się w roku na 1000 mieszkańców?"), "450540"),
    (ind("zgony", "Zgony", "na 1000 mieszkańców", 2, "ludnosc", "Ile osób umiera w roku na 1000 mieszkańców?"), "450541"),
    (ind("saldo_migracji", "Saldo przeprowadzek", "na 1000 mieszkańców", 1, "ludnosc",
         "Ile osób więcej się zameldowało, niż wymeldowało (na 1000 mieszkańców)? Ujemna liczba: więcej osób wyjechało.",
         scale="diverging"), "1365239"),
    # Pomoc społeczna
    (ind("beneficjenci", "Osoby korzystające z pomocy społecznej", "na 10 tys. mieszkańców", 0, "pomoc",
         "Ile osób na 10 tysięcy mieszkańców korzysta ze środowiskowej pomocy społecznej?", area="ubostwo"), "1548717"),
    # Rodzina i dzieci
    (ind("zlobki", "Dzieci w żłobkach i klubach dziecięcych", "na 1000 dzieci do lat 3", 0, "rodzina",
         "Ile dzieci do lat 3 na 1000 chodzi do żłobka albo klubu dziecięcego?", area="rodzina_piecza"), "1649859"),
    # Praca i gospodarka
    (ind("bezrobotni", "Bezrobotni wśród osób w wieku pracy", "%", 1, "praca",
         "Jaka część osób w wieku produkcyjnym jest zarejestrowana jako bezrobotna?"), ("P2670", ["ogółem"])),
    (ind("pracujacy", "Pracujący", "na 1000 mieszkańców", 0, "praca", "Ile osób na 1000 mieszkańców pracuje (bez rolników indywidualnych)?"),
     "454132"),
    (ind("dzialalnosc", "Osoby prowadzące firmę", "na 100 osób w wieku produkcyjnym", 1, "praca",
         "Ile osób na 100 w wieku pracy prowadzi własną działalność gospodarczą?"), "288054"),
    (ind("firmy", "Firmy i instytucje w rejestrze REGON", "na 10 tys. mieszkańców", 0, "praca",
         "Ile firm i instytucji jest zarejestrowanych na 10 tysięcy mieszkańców?"), "60530"),
    (ind("organizacje", "Fundacje, stowarzyszenia i organizacje społeczne", "na 10 tys. mieszkańców", 1, "praca",
         "Ile organizacji pozarządowych działa na 10 tysięcy mieszkańców?"), "288095"),
    # Edukacja
    (ind("przedszkola", "Dzieci 3–5 lat w przedszkolach", "%", 1, "edukacja",
         "Jaka część dzieci w wieku 3–5 lat chodzi do przedszkola? Ponad 100%: przychodzą też dzieci spoza gminy.",
         area="rodzina_piecza"), "1617168"),
    # Zdrowie
    (ind("przychodnie", "Przychodnie", "na 10 tys. mieszkańców", 1, "zdrowie", "Ile przychodni przypada na 10 tysięcy mieszkańców?",
         area="zdrowie"), "395397"),
    # Kultura i sport
    (ind("biblioteki", "Biblioteki publiczne", "na 10 tys. mieszkańców", 1, "kultura",
         "Ile bibliotek publicznych (z filiami) przypada na 10 tysięcy mieszkańców?"), "1609347"),
    (ind("czytelnicy", "Czytelnicy bibliotek", "na 1000 mieszkańców", 0, "kultura", "Ile osób na 1000 mieszkańców wypożycza w bibliotece?"),
     "60191"),
    (ind("domy_kultury", "Domy kultury, kluby i świetlice", "na 10 tys. mieszkańców", 1, "kultura",
         "Ile domów kultury, klubów i świetlic przypada na 10 tysięcy mieszkańców?"), "1609349"),
    (ind("obiekty_sportowe", "Obiekty sportowe", "na 10 tys. mieszkańców", 1, "kultura",
         "Ile obiektów sportowych (boisk, hal, basenów) przypada na 10 tysięcy mieszkańców?"), "1726208"),
    # Budżet gminy
    (ind("dochody", "Dochody gminy", "zł na mieszkańca", 0, "finanse", "Ile wynoszą dochody budżetu gminy na jednego mieszkańca?"),
     ("P2627", ["ogółem"])),
    (ind("dochody_wlasne", "Dochody własne gminy", "zł na mieszkańca", 0, "finanse",
         "Ile gmina zarabia sama (podatki, opłaty) na jednego mieszkańca, bez dotacji i subwencji?"), ("P2627", ["dochody własne"])),
    # Mieszkania i otoczenie
    (ind("metraz", "Powierzchnia mieszkania na osobę", "m²", 1, "otoczenie", "Ile metrów kwadratowych mieszkania przypada na jedną osobę?"),
     "60573"),
    (ind("nowe_mieszkania", "Nowe mieszkania", "na 1000 mieszkańców", 1, "otoczenie",
         "Ile mieszkań oddano do użytku w roku na 1000 mieszkańców?"), "747060"),
    (ind("zielen", "Tereny zieleni", "m² na mieszkańca", 1, "otoczenie", "Ile metrów kwadratowych parków i zieleni przypada na mieszkańca?"),
     "1724789"),
    (ind("drogi_rowerowe", "Drogi dla rowerów", "km na 10 tys. mieszkańców", 1, "otoczenie",
         "Ile kilometrów dróg rowerowych przypada na 10 tysięcy mieszkańców?"), "288082"),
    (ind("odpady", "Odpady z gospodarstw domowych", "kg na mieszkańca", 0, "otoczenie", "Ile kilogramów śmieci wytwarza w roku jeden mieszkaniec?"),
     "288061"),
]


def resolve(bdl: Bdl, spec) -> str | None:
    if isinstance(spec, str):
        return spec
    subject, words = spec
    for v in bdl.all_pages("/variables", **{"subject-id": subject}):
        name = " ".join(str(v.get(f"n{i}", "")) for i in range(1, 6)).lower()
        if all(w in name for w in words):
            return str(v["id"])
    return None


def main() -> None:
    bdl = Bdl()
    this_year = time.localtime().tm_year
    years = list(range(this_year - 5, this_year))
    indicators, values = [], {}
    for meta, spec in GMINA_BDL:
        var = resolve(bdl, spec)
        if not var:
            print(f"  pomijam {meta['key']}: brak zmiennej {spec}")
            continue
        try:
            data = bdl.variable(var, years)
        except Exception as e:  # zmienna bez poziomu gmin albo zła — nie przerywamy całości
            print(f"  pomijam {meta['key']} ({var}): {e}")
            continue
        gminy = {uid: by_year for uid, by_year in data.items() if uid[-1] in GMINA_KINDS}
        year = next((y for y in sorted(years, reverse=True)
                     if sum(1 for v in gminy.values() if v.get(y) is not None) >= MIN_UNITS), None)
        if not year:
            print(f"  pomijam {meta['key']} ({var}): za mało gmin z danymi w latach {years[0]}–{years[-1]}")
            continue
        for uid, by_year in gminy.items():
            if by_year.get(year) is not None:
                values.setdefault(bdl_to_teryt(uid), {})[meta["key"]] = round(float(by_year[year]), meta["decimals"] + 1)
        indicators.append({**{k: v for k, v in meta.items() if k not in ("csv", "zero_is_null")}, "bdl": var, "year": year})
        print(f"  {meta['key']}: zmienna {var}, rok {year}", flush=True)

    write_json(OUT / "gminy_wskazniki.json", {"indicators": indicators, "values": values})
    print(f"Zapisano out/gminy_wskazniki.json: {len(indicators)} z {len(GMINA_BDL)} wskaźników, {len(values)} gmin")


if __name__ == "__main__":
    main()
