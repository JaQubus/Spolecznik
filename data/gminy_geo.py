"""Kształty 183 gmin Małopolski do mapy gmin w „Kondycji Małopolski” → ../lib/gminy-shapes.json.

Źródło: Państwowy Rejestr Granic (PRG) GUGiK, usługa WFS „AdministrativeBoundaries”, warstwa
A03_Granice_gmin, filtrowana po kodzie TERYT województwa (12). Pobieramy raz do raw/ (kilkadziesiąt MB
GML w pełnej rozdzielczości), a do repo trafiają tylko uproszczone ścieżki SVG — ten sam rzut
i format co lib/powiaty-shapes.json (powiaty_geo.svg_shapes).

Klucz kształtu to 7-cyfrowy TERYT gminy (JPT_KOD_JE), taki sam jak gminy.teryt w bazie.

Uruchomienie: uv run gminy_geo.py"""
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from common import OUT, RAW, ROOT, read_json
from powiaty_geo import svg_shapes

WFS = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries"
GML_PATH = RAW / "gminy-malopolska.gml"
OUT_PATH = ROOT.parent / "lib" / "gminy-shapes.json"
TOLERANCE = 0.0025  # gminy są mniejsze od powiatów, więc upraszczamy delikatniej

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
