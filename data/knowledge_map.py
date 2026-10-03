"""Mapa Małopolski dla Zasobnika: prawdziwe granice gmin i powiatów + dane, które już mamy.

Granice: Państwowy Rejestr Granic (GUGiK), usługa WFS AdministrativeBoundaries, układ EPSG:2180.
Pobieramy 183 gminy województwa (TERYT 12*), upraszczamy je mapshaperem z zachowaniem topologii
(wspólne granice sąsiadów zostają wspólne, bez szpar), a powiaty i obrys województwa powstają
przez scalenie gmin — więc granice warstw pokrywają się co do punktu.

Dane:
- gminy: GUS, Bank Danych Lokalnych — ludność, udział 65+, zmiana ludności w 10 lat (out/gminy.json z bdl.py)
  i dodatkowe wskaźniki z out/gminy_wskazniki.json (bdl_wskazniki.py; bez tego pliku mapa ma tylko trzy bazowe),
- powiaty: Internetowy Obserwator Statystyk Społecznych ROPS (../dane/powiaty, 2024) — wszystkie wskaźniki.
Opisy i kategorie wskaźników: map_indicators.py.

Wynik: ../public/mapa/malopolska.json — ścieżki SVG gotowe do narysowania (viewBox w metrach
przeskalowanych do 1000 px szerokości) i wartości wskaźników. Pobiera go przeglądarka, gdy mapa
pojawia się na ekranie; tabela z tymi samymi danymi renderuje się na serwerze.

Wymaga mapshapera: npx mapshaper (albo ścieżka w zmiennej MAPSHAPER).
    cd data && uv run knowledge_map.py"""
import csv
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

from common import ROOT, write_json
from map_indicators import GMINA_INDICATORS, POWIAT_INDICATORS, POWIAT_SKIPPED, check
from scrape_knowledge import fetch

WFS = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries"
FILTER = ('<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsLike wildCard="*" singleChar="?" escapeChar="!">'
          "<fes:ValueReference>JPT_KOD_JE</fes:ValueReference><fes:Literal>12*</fes:Literal></fes:PropertyIsLike></fes:Filter>")
NS = {"gml": "http://www.opengis.net/gml/3.2", "ms": "http://mapserver.gis.umn.edu/mapserver"}
DEST = ROOT.parent / "public" / "mapa" / "malopolska.json"
WIDTH = 1000  # szerokość viewBox
# Podpisy na mapie dla orientacji (TERYT gminy → nazwa): największe miasta i Zakopane na południu.
LABELS = {"1261011": "Kraków", "1263011": "Tarnów", "1262011": "Nowy Sącz", "1217011": "Zakopane"}

PRG_SOURCE = {"title": "Państwowy Rejestr Granic (GUGiK)", "url": "https://www.geoportal.gov.pl/pl/dane/panstwowy-rejestr-granic-prg/"}
BDL_SOURCE = {"title": "GUS, Bank Danych Lokalnych", "url": "https://bdl.stat.gov.pl/"}
IOSS_SOURCE = {"title": "Internetowy Obserwator Statystyk Społecznych ROPS", "url": "https://obserwator.rops.krakow.pl/"}

# ── Granice z PRG ───────────────────────────────────────────

def download(type_name: str) -> Path:
    url = WFS + "?" + "&".join(f"{k}={v}" for k, v in {
        "SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature", "TYPENAMES": f"ms:{type_name}",
        "FILTER": FILTER,
    }.items())
    fetch(url, ".gml")
    from scrape_knowledge import _cache_path
    return _cache_path(url, ".gml")


def rings(geom: ET.Element) -> list[list[list[list[float]]]]:
    """GML Polygon / MultiSurface → lista poligonów [[pierścień zewnętrzny, …dziury]] w (x=wschód, y=północ)."""
    polys = []
    for poly in geom.iter(f"{{{NS['gml']}}}Polygon"):
        rs = []
        for tag in ("exterior", "interior"):
            for ring in poly.findall(f"gml:{tag}", NS):
                vals = [float(v) for v in ring.find(".//gml:posList", NS).text.split()]
                # EPSG:2180 w GML 3.2: kolejność osi północ, wschód.
                rs.append([[vals[i + 1], vals[i]] for i in range(0, len(vals), 2)])
        polys.append(rs)
    return polys


def gminy_geojson(path: Path) -> dict:
    features = []
    for _, el in ET.iterparse(path):
        if el.tag != f"{{{NS['ms']}}}A03_Granice_gmin":
            continue
        teryt = el.findtext("ms:JPT_KOD_JE", namespaces=NS)
        name = el.findtext("ms:JPT_NAZWA_", namespaces=NS)
        polys = rings(el.find("ms:msGeometry", NS))
        features.append({"type": "Feature", "properties": {"id": teryt, "name": name, "powiat": teryt[:4]},
                         "geometry": {"type": "MultiPolygon", "coordinates": polys}})
        el.clear()
    return {"type": "FeatureCollection", "features": features}


def powiat_names(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    codes = re.findall(r"<ms:JPT_KOD_JE>([^<]+)<", text)
    names = re.findall(r"<ms:JPT_NAZWA_>([^<]+)<", text)
    # „powiat Kraków” → „Kraków (miasto na prawach powiatu)”, „powiat bocheński” → „powiat bocheński”
    return {c: (f"{n.removeprefix('powiat ')} (miasto na prawach powiatu)" if n.split()[-1][0].isupper() else n) for c, n in zip(codes, names)}


def mapshaper(src: Path, out_dir: Path) -> None:
    """Upraszczanie z zachowaniem topologii + scalenie gmin w powiaty i województwo."""
    cmd = os.environ.get("MAPSHAPER", "npx -y mapshaper")
    args = [
        "-i", str(src), "name=gminy",
        "-simplify", "weighted", os.environ.get("MAP_SIMPLIFY", "1.5%"), "keep-shapes",
        "-clean",
        "-o", str(out_dir / "gminy.json"), "format=geojson", "precision=1", "geojson-type=FeatureCollection",
        "-dissolve", "powiat", "+", "name=powiaty",
        "-o", str(out_dir / "powiaty.json"), "format=geojson", "precision=1", "geojson-type=FeatureCollection",
        "-dissolve", "target=gminy", "+", "name=wojewodztwo",
        "-o", str(out_dir / "wojewodztwo.json"), "format=geojson", "precision=1", "geojson-type=FeatureCollection",
    ]
    subprocess.run([*shlex.split(cmd), *args], check=True)


# ── Ścieżki SVG ─────────────────────────────────────────────

class Projector:
    """Metry EPSG:2180 → piksele viewBox (oś Y odwrócona: północ na górze)."""
    def __init__(self, fc: dict):
        xs, ys = [], []
        for f in fc["features"]:
            for poly in polygons(f["geometry"]):
                for ring in poly:
                    for x, y in ring:
                        xs.append(x); ys.append(y)
        self.x0, self.y1 = min(xs), max(ys)
        self.k = WIDTH / (max(xs) - self.x0)
        self.height = round((self.y1 - min(ys)) * self.k)

    def path(self, geometry: dict) -> str:
        parts = []
        for poly in polygons(geometry):
            for ring in poly:
                # Całe piksele (1 px ≈ 280 m) i bez powtórzeń po zaokrągleniu — plik ma być lekki na telefonie.
                pts: list[tuple[int, int]] = []
                for x, y in ring:
                    pt = (round((x - self.x0) * self.k), round((self.y1 - y) * self.k))
                    if not pts or pts[-1] != pt:
                        pts.append(pt)
                if len(pts) >= 3:
                    parts.append("M" + "L".join(f"{x},{y}" for x, y in pts) + "Z")
        return "".join(parts)


    def centroid(self, geometry: dict) -> list[int]:
        """Środek ciężkości największego pierścienia (wzór na pole wielokąta), w pikselach viewBox."""
        best = max((poly[0] for poly in polygons(geometry)), key=lambda r: abs(ring_area(r)))
        a = ring_area(best)
        cx = sum((x0 + x1) * (x0 * y1 - x1 * y0) for (x0, y0), (x1, y1) in zip(best, best[1:] + best[:1])) / (6 * a)
        cy = sum((y0 + y1) * (x0 * y1 - x1 * y0) for (x0, y0), (x1, y1) in zip(best, best[1:] + best[:1])) / (6 * a)
        return [round((cx - self.x0) * self.k), round((self.y1 - cy) * self.k)]


def ring_area(ring) -> float:
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1])) / 2


def polygons(geometry: dict):
    return geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]


# ── Dane ────────────────────────────────────────────────────

def gmina_values() -> tuple[dict, list[dict]]:
    """Wartości po TERYT i lista wskaźników (z rokiem danych) — bazowe z bdl.py plus dodatkowe z bdl_wskazniki.py."""
    rows = json.loads((ROOT / "out" / "gminy.json").read_text(encoding="utf-8"))
    year = max(r["wskazniki"].get("rok", 0) for r in rows)
    values = {r["teryt"]: {"name": r["nazwa"], "type": r["typ"], **{i["key"]: r.get(i["key"]) for i in GMINA_INDICATORS}} for r in rows}
    indicators = [{**i, "year": year} for i in GMINA_INDICATORS]
    extra_path = ROOT / "out" / "gminy_wskazniki.json"
    if extra_path.exists():
        extra = json.loads(extra_path.read_text(encoding="utf-8"))
        base_keys = {i["key"] for i in GMINA_INDICATORS}
        for i in extra["indicators"]:
            if i["key"] not in base_keys:
                indicators.append(i)
        for teryt, v in values.items():
            for i in extra["indicators"]:
                v.setdefault(i["key"], extra["values"].get(teryt, {}).get(i["key"]))
    else:
        print("Brak out/gminy_wskazniki.json — gminy tylko z trzema wskaźnikami (uruchom bdl_wskazniki.py)", file=sys.stderr)
    check(indicators)
    return values, indicators


def powiat_values(names: dict[str, str]) -> tuple[dict, list[dict]]:
    rows = list(csv.DictReader(open(ROOT.parent / "dane" / "powiaty" / "wszystkie_powiaty.csv", encoding="utf-8-sig")))
    norm = lambda s: s.lower().replace("powiat ", "").replace("m. ", "").replace(" (miasto na prawach powiatu)", "").strip()
    by_name = {norm(n): code for code, n in names.items()}
    by_csv = {i["csv"]: i for i in POWIAT_INDICATORS}
    unmapped = {r["wskaznik"] for r in rows} - by_csv.keys() - POWIAT_SKIPPED.keys()
    if unmapped:
        sys.exit(f"Wskaźniki IOSS bez opisu w map_indicators.py: {sorted(unmapped)}")
    out: dict[str, dict] = {code: {} for code in names}
    years: dict[str, int] = {}
    for r in rows:
        ind = by_csv.get(r["wskaznik"])
        code = by_name.get(norm(r["powiat"]))
        if not (ind and code and r["wartosc"]):
            continue
        v = float(r["wartosc"])
        # „Mieszkańcy na 1 miejsce w kinie” = 0 znaczy „nie ma kina”, a nie „najlepszy dostęp”.
        out[code][ind["key"]] = None if ind["zero_is_null"] and v == 0 else v
        years[ind["key"]] = max(years.get(ind["key"], 0), int(r["rok"]))
    missing = [names[c] for c, v in out.items() if len(v) < 0.9 * len(POWIAT_INDICATORS)]
    if missing:
        sys.exit(f"Brak wskaźników IOSS dla: {missing}")
    check(POWIAT_INDICATORS)
    return out, [{**i, "year": years[i["key"]]} for i in POWIAT_INDICATORS]


def public(i: dict, source: dict) -> dict:
    """Opis wskaźnika do pliku dla przeglądarki: bez pól roboczych, ze źródłem i rokiem danych."""
    hidden = {"csv", "zero_is_null", "year", "bdl"}
    return {k: v for k, v in i.items() if k not in hidden} | {"source": {**source, "year": i["year"]}}


def main() -> None:
    gml_gminy = download("A03_Granice_gmin")
    gml_powiaty = download("A02_Granice_powiatow")
    names = powiat_names(gml_powiaty)
    fc = gminy_geojson(gml_gminy)
    if len(fc["features"]) < 180:
        sys.exit(f"Za mało gmin z PRG: {len(fc['features'])}")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "gminy_prg.json").write_text(json.dumps(fc))
        mapshaper(tmp / "gminy_prg.json", tmp)
        gminy = json.loads((tmp / "gminy.json").read_text())
        powiaty = json.loads((tmp / "powiaty.json").read_text())
        woj = json.loads((tmp / "wojewodztwo.json").read_text())

    proj = Projector(woj)
    g_values, g_indicators = gmina_values()
    p_values, p_indicators = powiat_values(names)
    missing = [f["properties"]["name"] for f in gminy["features"] if f["properties"]["id"] not in g_values]
    if missing:
        sys.exit(f"Gminy z PRG bez danych BDL: {missing}")

    data = {
        "viewBox": f"0 0 {WIDTH} {proj.height}",
        "outline": proj.path(woj["features"][0]["geometry"]),
        "labels": [{"name": name, "x": c[0], "y": c[1]} for f in gminy["features"]
                   if (name := LABELS.get(f["properties"]["id"])) and (c := proj.centroid(f["geometry"]))],
        "geometrySource": PRG_SOURCE,
        "layers": {
            "gminy": {
                "label": "Gminy",
                "units": sorted(({
                    "id": f["properties"]["id"],
                    "name": g_values[f["properties"]["id"]]["name"],
                    "parent": names[f["properties"]["powiat"]],
                    "kind": g_values[f["properties"]["id"]]["type"],
                    "d": proj.path(f["geometry"]),
                    "values": {i["key"]: g_values[f["properties"]["id"]].get(i["key"]) for i in g_indicators},
                } for f in gminy["features"]), key=lambda u: u["name"]),
                "indicators": [public(i, BDL_SOURCE) for i in g_indicators],
            },
            "powiaty": {
                "label": "Powiaty",
                "units": sorted(({
                    "id": f["properties"]["powiat"],
                    "name": names[f["properties"]["powiat"]],
                    "parent": None,
                    "kind": None,
                    "d": proj.path(f["geometry"]),
                    "values": {i["key"]: p_values[f["properties"]["powiat"]].get(i["key"]) for i in p_indicators},
                } for f in powiaty["features"]), key=lambda u: u["name"]),
                "indicators": [public(i, IOSS_SOURCE) for i in p_indicators],
            },
        },
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"gminy {len(data['layers']['gminy']['units'])}, powiaty {len(data['layers']['powiaty']['units'])}, "
          f"{DEST.stat().st_size // 1024} kB → {DEST.relative_to(ROOT.parent)}", file=sys.stderr)


if __name__ == "__main__":
    main()
