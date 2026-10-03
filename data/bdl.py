"""Profile gmin Małopolski z API BDL GUS (README sekcja 8.3).

Ludność ogółem, ludność wg wieku (udział 65+), zmiana ludności w 10 lat.
Identyfikatory jednostek BDL ≠ TERYT — mapujemy raz, przy pobieraniu.
Nagłówek X-ClientId (zmienna BDL_CLIENT_ID) podnosi limity.
Wynik: out/gminy.json."""
import os
import time

import httpx

from common import OUT, write_json

API = "https://bdl.stat.gov.pl/api/v1"
MALOPOLSKIE = "011200000000"
GMINA_LEVEL = 6

# Temat P2137 „Ludność wg grup wieku i płci” (poziom gminy)
VAR_TOTAL = "72305"            # ogółem, ogółem
VARS_65PLUS = ["72239", "72240"]  # 65–69 i 70 i więcej, ogółem

# Rodzaj jednostki BDL (ostatnia cyfra ID): 1 miejska, 2 wiejska, 3 miejsko-wiejska.
# 4/5 to miasto i obszar wiejski w gminie miejsko-wiejskiej, 8/9 dzielnice/delegatury — pomijamy.
GMINA_KINDS = {"1", "2", "3"}


def bdl_to_teryt(unit_id: str) -> str:
    """011212001011 → 1201011 (woj. + powiat + gmina + rodzaj)."""
    return unit_id[2:4] + unit_id[7:9] + unit_id[9:11] + unit_id[11]


class Bdl:
    """Klient z dławieniem: bez X-ClientId limit to kilka zapytań na sekundę."""

    def __init__(self) -> None:
        headers = {"Accept": "application/json"}
        if client_id := os.environ.get("BDL_CLIENT_ID"):
            headers["X-ClientId"] = client_id
        self.http = httpx.Client(base_url=API, headers=headers, timeout=30)
        self.delay = 0.3 if "X-ClientId" in headers else 1.2

    def get(self, path: str, **params) -> dict:
        params = {"format": "json", "lang": "pl", "page-size": 100, **params}
        for attempt in range(6):
            time.sleep(self.delay)
            r = self.http.get(path, params=params)
            if r.status_code == 429:
                # BDL podaje „Retry-After: 396 sek” — bez klucza okno potrafi trwać kilka minut.
                digits = "".join(c for c in r.headers.get("Retry-After", "") if c.isdigit())
                wait = int(digits) + 1 if digits else 30 * (attempt + 1)
                print(f"  limit BDL, czekam {wait} s", flush=True)
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
        raise RuntimeError(f"BDL: za dużo zapytań ({path})")

    def all_pages(self, path: str, **params) -> list[dict]:
        out, page = [], 0
        while True:
            data = self.get(path, page=page, **params)
            out += data["results"]
            # /units ma pageSize, /data go nie ma — w obu jest links.next, gdy są kolejne strony.
            if not data.get("links", {}).get("next"):
                return out
            page += 1

    def variable(self, var_id: str, years: list[int]) -> dict[str, dict[int, float]]:
        """unit_id → {rok: wartość} dla wszystkich gmin województwa."""
        rows = self.all_pages(
            f"/data/by-variable/{var_id}",
            **{"unit-parent-id": MALOPOLSKIE, "unit-level": GMINA_LEVEL, "year": years},
        )
        return {r["id"]: {int(v["year"]): v["val"] for v in r["values"]} for r in rows}


def latest_year(bdl: Bdl) -> int:
    """Ostatni rok, dla którego jest ludność ogółem (BDL publikuje z opóźnieniem)."""
    meta = bdl.get(f"/variables/{VAR_TOTAL}")
    years = meta.get("years") or []
    if years:
        return max(years)
    return time.localtime().tm_year - 2


def main() -> None:
    bdl = Bdl()
    year = latest_year(bdl)
    base = year - 10
    print(f"Rok danych: {year}, porównanie z {base}")

    units = bdl.all_pages("/units", **{"parent-id": MALOPOLSKIE, "level": GMINA_LEVEL})
    gminy_units = [u for u in units if u["id"][-1] in GMINA_KINDS]
    powiaty = {u["id"]: u["name"] for u in bdl.all_pages("/units", **{"parent-id": MALOPOLSKIE, "level": 5})}
    print(f"Gmin: {len(gminy_units)} (z {len(units)} jednostek poziomu 6)")

    total = bdl.variable(VAR_TOTAL, [base, year])
    old = [bdl.variable(v, [year]) for v in VARS_65PLUS]

    # Gmina, która zmieniła typ (np. wiejska → miejsko-wiejska po nadaniu praw miejskich), dostaje
    # nowy TERYT; wartość sprzed 10 lat jest wtedy pod starym ID o tej samej nazwie w tym samym powiecie.
    base_by_name = {
        (u["name"], u["parentId"]): total[u["id"]][base]
        for u in gminy_units if total.get(u["id"], {}).get(base)
    }

    kind_label = {"1": "miejska", "2": "wiejska", "3": "miejsko-wiejska"}
    gminy = []
    for u in gminy_units:
        uid = u["id"]
        pop = total.get(uid, {}).get(year)
        if not pop:
            continue  # jednostka historyczna — dziś nie istnieje
        pop_base = total.get(uid, {}).get(base) or base_by_name.get((u["name"], u["parentId"]))
        pop_65 = sum(o.get(uid, {}).get(year) or 0 for o in old)
        gminy.append({
            "teryt": bdl_to_teryt(uid),
            "bdl_id": uid,
            "nazwa": u["name"],
            "powiat": powiaty.get(u["parentId"], "").removeprefix("Powiat ").removeprefix("powiat "),
            "typ": kind_label[uid[-1]],
            "ludnosc": int(pop) if pop else None,
            "udzial_65plus": round(100 * pop_65 / pop, 1) if pop and pop_65 else None,
            "zmiana_ludnosci_10l": round(100 * (pop - pop_base) / pop_base, 1) if pop and pop_base else None,
            "wskazniki": {"rok": year},
        })

    gminy.sort(key=lambda g: g["teryt"])
    write_json(OUT / "gminy.json", gminy)
    no_change = [g["nazwa"] for g in gminy if g["zmiana_ludnosci_10l"] is None]
    print(f"Zapisano out/gminy.json: {len(gminy)} gmin; bez zmiany w 10 lat (nowe gminy): {no_change}")


if __name__ == "__main__":
    main()
