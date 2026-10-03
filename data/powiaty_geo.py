"""Kształty 22 powiatów Małopolski do mapy „Kondycja Małopolski” → ../lib/powiaty-shapes.json.

Źródło: granice powiatów z PRG GUGiK (dane bez opłat), przekonwertowane do GeoJSON
w repozytorium ppatrzyk/polska-geojson (wersja „medium”). Pobieramy raz do raw/.

Wynik to gotowe ścieżki SVG (rzut równoodległościowy ze skalą cos φ dla ~50°N,
uproszczenie Douglasa-Peuckera), więc strona nie potrzebuje Leafleta ani podkładu mapowego:
mapa renderuje się po stronie serwera, działa bez JavaScriptu i przy 320 px.

Uruchomienie: uv run powiaty_geo.py"""
import json
import math
import urllib.request

from common import RAW, ROOT, read_json
from import_powiaty import powiat_id

GEOJSON_URL = "https://raw.githubusercontent.com/ppatrzyk/polska-geojson/master/powiaty/powiaty-medium.geojson"
GEOJSON_PATH = RAW / "powiaty-medium.geojson"
OUT_PATH = ROOT.parent / "lib" / "powiaty-shapes.json"

WIDTH = 600            # szerokość viewBox; wysokość wynika z proporcji
TOLERANCE = 0.004      # stopnie; ok. 300–400 m — granice nadal rozpoznawalne, plik kilkadziesiąt kB
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


def polygons(geometry: dict) -> list[list[list[tuple[float, float]]]]:
    coords = geometry["coordinates"]
    polys = [coords] if geometry["type"] == "Polygon" else coords
    return [[[(x, y) for x, y in ring] for ring in poly] for poly in polys]


def svg_shapes(shapes: dict[str, list], key: str, tolerance: float, width: int = WIDTH) -> dict:
    """Wielokąty (lon, lat) → ścieżki SVG w viewBox o szerokości `width` + środek do podpisu.
    Wspólne dla map powiatów i gmin, żeby obie miały ten sam rzut i format."""
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


def main() -> None:
    if not GEOJSON_PATH.exists():
        GEOJSON_PATH.parent.mkdir(parents=True, exist_ok=True)
        print(f"pobieram {GEOJSON_URL}")
        urllib.request.urlretrieve(GEOJSON_URL, GEOJSON_PATH)
    features = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))["features"]

    # Nazwy jak w CSV: „powiat m. Kraków” w GeoJSON to „powiat Kraków”. Te same nazwy mają też powiaty
    # w innych województwach (np. brzeski w opolskim), więc bierzemy tylko te z ramki Małopolski.
    wanted = {powiat_id(r["nazwa"]) for r in read_json(ROOT / "out" / "powiaty.json")}
    shapes = {}
    for f in features:
        polys = polygons(f["geometry"])
        ring = polys[0][0]
        lon = sum(p[0] for p in ring) / len(ring)
        lat = sum(p[1] for p in ring) / len(ring)
        pid = powiat_id(f["properties"]["nazwa"])
        if pid in wanted and 19.0 < lon < 21.5 and 49.1 < lat < 50.6:
            shapes[pid] = polys
    missing = wanted - shapes.keys()
    if missing:
        raise SystemExit(f"! brak kształtów dla: {sorted(missing)}")

    result = svg_shapes(shapes, "powiat", TOLERANCE)
    OUT_PATH.write_text(
        json.dumps(result, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"{len(result['shapes'])} powiatów → {OUT_PATH.relative_to(ROOT.parent)} ({OUT_PATH.stat().st_size // 1024} kB)")


if __name__ == "__main__":
    main()
