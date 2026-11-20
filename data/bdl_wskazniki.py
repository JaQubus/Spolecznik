"""Wskaźniki gmin i powiatów z API BDL GUS do mapy regionu (gminy: obok bazowych z bdl.py).

Każdy wskaźnik to zmienna BDL (id) albo temat + słowa, po których szukamy zmiennej w temacie
(numery zmiennych w nowych tematach bywają zmieniane). Dla każdej zmiennej bierzemy najnowszy rok,
w którym są dane dla większości jednostek (progi w region.py); zmienne bez danych na danym poziomie pomijamy z ostrzeżeniem.
Powiaty mają te same zmienne co gminy plus trzy bazowe (ludność, zmiana w 10 lat, 65+), liczone na poziomie powiatu.
Bez X-ClientId (BDL_CLIENT_ID w ../.env.local) limit to 1000 zapytań na 12 godzin — skrypt robi ich ok. 150.

Wynik: out/gminy_wskazniki.json albo out/powiaty_wskazniki.json — opisy wskaźników (dla knowledge_map.py) i wartości po TERYT.
    cd data && uv run bdl_wskazniki.py                  (gminy)
    cd data && uv run bdl_wskazniki.py --level powiat   (powiaty)"""
import sys
import time

from bdl import GMINA_KINDS, GMINA_LEVEL, POWIAT_LEVEL, VAR_TOTAL, VARS_65PLUS, Bdl, bdl_to_teryt, latest_year
from common import OUT, write_json
from map_indicators import POWIAT_BASE, ind
from region import MIN_GMINY, MIN_POWIATY

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


def unit_key(uid: str, level: int) -> str | None:
    """TERYT jednostki: gmina 7 cyfr, powiat 4 (pierwsze 4 cyfry kodu gminy, jak w PRG i na mapie)."""
    if level == POWIAT_LEVEL:
        return bdl_to_teryt(uid)[:4]
    return bdl_to_teryt(uid) if uid[-1] in GMINA_KINDS else None


def collect(bdl: Bdl, specs: list, level: int, min_units: int, years: list[int]) -> tuple[list[dict], dict]:
    indicators, values = [], {}
    for meta, spec in specs:
        var = resolve(bdl, spec)
        if not var:
            print(f"  pomijam {meta['key']}: brak zmiennej {spec}")
            continue
        try:
            data = bdl.variable(var, years, level)
        except Exception as e:  # zmienna bez tego poziomu albo zła — nie przerywamy całości
            print(f"  pomijam {meta['key']} ({var}): {e}")
            continue
        units = {key: by_year for uid, by_year in data.items() if (key := unit_key(uid, level))}
        year = next((y for y in sorted(years, reverse=True)
                     if sum(1 for v in units.values() if v.get(y) is not None) >= min_units), None)
        if not year:
            print(f"  pomijam {meta['key']} ({var}): za mało jednostek z danymi w latach {years[0]}–{years[-1]}")
            continue
        for key, by_year in units.items():
            if by_year.get(year) is not None:
                values.setdefault(key, {})[meta["key"]] = round(float(by_year[year]), meta["decimals"] + 1)
        indicators.append({**{k: v for k, v in meta.items() if k not in ("csv", "zero_is_null")}, "bdl": var, "year": year})
        print(f"  {meta['key']}: zmienna {var}, rok {year}", flush=True)
    return indicators, values


def powiat_base(bdl: Bdl) -> tuple[list[dict], dict]:
    """Trzy bazowe wskaźniki jak dla gmin w bdl.py: ludność, zmiana w 10 lat, udział 65+ — liczone na poziomie powiatu."""
    year = latest_year(bdl)
    total = bdl.variable(VAR_TOTAL, [year - 10, year], POWIAT_LEVEL)
    old = [bdl.variable(v, [year], POWIAT_LEVEL) for v in VARS_65PLUS]
    values: dict[str, dict] = {}
    for uid, by_year in total.items():
        pop, pop_base = by_year.get(year), by_year.get(year - 10)
        if not pop:
            continue
        pop_65 = sum(o.get(uid, {}).get(year) or 0 for o in old)
        values[bdl_to_teryt(uid)[:4]] = {
            "ludnosc": int(pop),
            "zmiana_ludnosci_10l": round(100 * (pop - pop_base) / pop_base, 1) if pop_base else None,
            "udzial_65plus": round(100 * pop_65 / pop, 1) if pop_65 else None,
        }
    return [{**i, "year": year} for i in POWIAT_BASE], values


def main() -> None:
    bdl = Bdl()
    this_year = time.localtime().tm_year
    years = list(range(this_year - 5, this_year))
    level = sys.argv[sys.argv.index("--level") + 1] if "--level" in sys.argv else "gmina"
    if level == "powiat":
        base_ind, values = powiat_base(bdl)
        indicators, extra = collect(bdl, GMINA_BDL, POWIAT_LEVEL, MIN_POWIATY, years)
        for key, v in extra.items():
            values.setdefault(key, {}).update(v)
        indicators = base_ind + indicators
        write_json(OUT / "powiaty_wskazniki.json", {"indicators": indicators, "values": values})
        print(f"Zapisano out/powiaty_wskazniki.json: {len(indicators)} wskaźników, {len(values)} powiatów")
        return
    indicators, values = collect(bdl, GMINA_BDL, GMINA_LEVEL, MIN_GMINY, years)
    write_json(OUT / "gminy_wskazniki.json", {"indicators": indicators, "values": values})
    print(f"Zapisano out/gminy_wskazniki.json: {len(indicators)} z {len(GMINA_BDL)} wskaźników, {len(values)} gmin")


if __name__ == "__main__":
    main()
