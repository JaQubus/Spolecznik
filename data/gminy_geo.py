"""Kształty 183 gmin Małopolski do mapy gmin w „Kondycji Małopolski” → ../lib/gminy-shapes.json.

Źródło: Państwowy Rejestr Granic (PRG) GUGiK, usługa WFS „AdministrativeBoundaries”, warstwa
A03_Granice_gmin, filtrowana po kodzie TERYT województwa (12). Pobieramy raz do raw/ (ok. 10 MB GML
w pełnej rozdzielczości), a do repo trafiają tylko uproszczone ścieżki SVG (rzut równoodległościowy
ze skalą cos φ dla ~50°N, uproszczenie Douglasa-Peuckera), więc strona nie potrzebuje Leafleta.

Klucz kształtu to 7-cyfrowy TERYT gminy (JPT_KOD_JE), taki sam jak gminy.teryt w bazie.

Uruchomienie: uv run gminy_geo.py"""
import json
import math
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from common import OUT, RAW, ROOT, read_json

WFS = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries"
GML_PATH = RAW / "gminy-malopolska.gml"
OUT_PATH = ROOT.parent / "lib" / "gminy-shapes.json"
TOLERANCE = 0.0025  # stopnie, ok. 200 m — granice gmin nadal rozpoznawalne, plik ok. 100 kB
WIDTH = 600         # szerokość viewBox; wysokość wynika z proporcji
LAT0 = math.radians(49.85)


def simplify(points: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Douglas-Peucker (iteracyjnie, bez rekurencji)."""
    if len(points) < 4:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = points[a], points[b]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy) or 1e-12
        best, idx = 0.0, -1
        for i in range(a + 1, b):
            x, y = points[i]
            d = abs(dy * (x - x1) - dx * (y - y1)) / norm
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(points, keep) if k]


def simplify_ring(ring: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Pierścień jest zamknięty (pierwszy punkt = ostatni), więc upraszczamy osobno dwie połowy."""
    mid = len(ring) // 2
    return simplify(ring[:mid + 1], tol)[:-1] + simplify(ring[mid:], tol)


def svg_shapes(shapes: dict[str, list], key: str, tolerance: float, width: int = WIDTH) -> dict:
    """Wielokąty (lon, lat) → ścieżki SVG w viewBox o szerokości `width` + środek obszaru."""
    project = lambda lon, lat: (lon * math.cos(LAT0), -lat)  # noqa: E731
    projected = {
        pid: [[[project(*p) for p in simplify_ring(ring, tolerance)] for ring in poly] for poly in polys]
        for pid, polys in shapes.items()
    }
    xs = [x for polys in projected.values() for poly in polys for ring in poly for x, _ in ring]
    ys = [y for polys in projected.values() for poly in polys for ring in poly for _, y in ring]
    scale = width / (max(xs) - min(xs))
    height = round((max(ys) - min(ys)) * scale)
    to_svg = lambda x, y: (round((x - min(xs)) * scale, 1), round((y - min(ys)) * scale, 1))  # noqa: E731

    out = []
    for pid, polys in sorted(projected.items()):
        parts, area_best, centre = [], -1.0, (0.0, 0.0)
        for poly in polys:
            for k, ring in enumerate(poly):
                pts = [to_svg(x, y) for x, y in ring]
                parts.append("M" + "L".join(f"{x:g},{y:g}" for x, y in pts) + "Z")
                if k == 0:  # środek największego pierścienia zewnętrznego — tylko do podpisu
                    area = abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))) / 2
                    if area > area_best:
                        area_best = area
                        centre = (round(sum(p[0] for p in pts) / len(pts), 1), round(sum(p[1] for p in pts) / len(pts), 1))
        out.append({key: pid, "d": "".join(parts), "cx": centre[0], "cy": centre[1]})

    return {"width": width, "height": height, "shapes": out}


NS = {"gml": "http://www.opengis.net/gml", "ms": "http://mapserver.gis.umn.edu/mapserver"}

FILTER = (
    '<Filter xmlns="http://www.opengis.net/ogc"><PropertyIsLike wildCard="*" singleChar="?" escape="!">'
    "<PropertyName>JPT_KOD_JE</PropertyName><Literal>12*</Literal></PropertyIsLike></Filter>"
)


def download() -> None:
    params = {
        "service": "WFS", "version": "1.1.0", "request": "GetFeature",
        "typeName": "ms:A03_Granice_gmin", "srsName": "EPSG:4326",
        "outputFormat": "text/xml; subtype=gml/2.1.2", "filter": FILTER,
    }
    url = f"{WFS}?{urllib.parse.urlencode(params)}"
    print("pobieram granice gmin z WFS PRG GUGiK…")
    GML_PATH.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=600) as r:
        GML_PATH.write_bytes(r.read())


def ring(el: ET.Element) -> list[tuple[float, float]]:
    """GML 2 w EPSG:4326 ma kolejność „szerokość,długość” — odwracamy na (lon, lat)."""
    text = el.find(".//gml:coordinates", NS).text.split()
    return [(float(lon), float(lat)) for lat, lon in (p.split(",") for p in text)]


def polygons(geometry: ET.Element) -> list[list[list[tuple[float, float]]]]:
    out = []
    for poly in geometry.iter(f"{{{NS['gml']}}}Polygon"):
        rings = [ring(poly.find("gml:outerBoundaryIs", NS))]
        rings += [ring(r) for r in poly.findall("gml:innerBoundaryIs", NS)]
        out.append(rings)
    return out


def main() -> None:
    if not GML_PATH.exists():
        download()
    root = ET.parse(GML_PATH).getroot()

    wanted = {g["teryt"] for g in read_json(OUT / "gminy.json")}
    shapes = {}
    for member in root.iter(f"{{{NS['gml']}}}featureMember"):
        feature = member[0]
        teryt = feature.findtext("ms:JPT_KOD_JE", namespaces=NS)
        if teryt in wanted:
            shapes[teryt] = polygons(feature.find("ms:msGeometry", NS))
    missing = wanted - shapes.keys()
    if missing:
        raise SystemExit(f"! brak kształtów dla gmin: {sorted(missing)}")

    result = svg_shapes(shapes, "teryt", TOLERANCE)
    OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(result['shapes'])} gmin → {OUT_PATH.relative_to(ROOT.parent)} ({OUT_PATH.stat().st_size // 1024} kB)")


if __name__ == "__main__":
    main()
