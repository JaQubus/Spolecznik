"""Europejski Urząd Patentowy (Open Patent Services): zgłoszenia EP i PL instytucji publicznych z regionu.

OPS wymaga darmowej rejestracji (developers.epo.org) i klucza OAuth. Bez klucza zwraca 403 — wtedy zapisujemy
migawkę przykładową, w tym odpowiednik EP zgłoszenia uczelni z Rzeszowa (przypadek demo 2, sprawdzanie dublowania).
Z kluczem w ../.env.local (EPO_OPS_KEY, EPO_OPS_SECRET) importer pyta OPS o publikacje, w których zgłaszającym jest
uczelnia publiczna regionu (lista w base.PUBLIC_UNIVERSITIES), i bierze tytuł, abstrakt, zgłaszającego i datę.
Nazwiska wynalazców pomijamy. Warunki: EPO OPS Terms and Conditions (fair use, limit tygodniowy, podanie źródła).

    cd data && uv run sources/epo_ops.py
"""
import os
import xml.etree.ElementTree as ET

import httpx

from base import PUBLIC_UNIVERSITIES, USER_AGENT, normalize, save_snapshot, save_synthetic

OPS = "https://ops.epo.org/3.2"
LICENSE = "EPO Open Patent Services — dane bibliograficzne, warunki OPS Terms and Conditions (fair use, podanie źródła: EPO)."
NS = {"ops": "http://ops.epo.org", "ex": "http://www.epo.org/exchange"}
# Nazwy, pod którymi uczelnie regionu występują jako zgłaszający w DOCDB (OPS szuka po słowach, bez polskich znaków).
APPLICANT_QUERIES = ["politechnika rzeszowska", "uniwersytet rzeszowski", "rzeszow university of technology"]

RECORDS = [
    dict(external_id="PRZYKLAD-EP-001", kind="zgloszenie_patentowe", institution="Politechnika Rzeszowska", published_on="2026-09-23",
         title="Method of manufacturing load-bearing parts from shredded carbon fibre reinforced composite waste",
         abstract="Production waste of carbon fibre reinforced composite is shredded, the fibres are aligned and re-bonded with a "
                  "thermoplastic resin in a press. The parts, such as aircraft cabin brackets, reach strength close to virgin composite.",
         inventors=["Jan Przykładowy"],
         keywords=["kompozyt", "włókno węglowe", "recykling", "wspornik", "lotnictwo"]),
    dict(external_id="PRZYKLAD-EP-002", kind="zgloszenie_patentowe", institution="Uniwersytet Rzeszowski", published_on="2026-07-01",
         title="Radar-based contactless fall detection system for indoor use",
         abstract="A millimetre-wave radar module detects falls from velocity and height of body reflections without recording images.",
         keywords=["radar", "upadek", "senior", "czujnik"]),
]


def token(key: str, secret: str) -> str:
    r = httpx.post(f"{OPS}/auth/accesstoken", data={"grant_type": "client_credentials"}, auth=(key, secret),
                   headers={"User-Agent": USER_AGENT}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def text(node, path: str) -> str | None:
    found = node.find(path, NS)
    return "".join(found.itertext()).strip() if found is not None else None


def fetch(key: str, secret: str) -> list[dict]:
    """Wyszukiwanie z bibliografią (published-data/search/biblio), po 25 wyników na zgłaszającego."""
    headers = {"Authorization": f"Bearer {token(key, secret)}", "User-Agent": USER_AGENT, "Range": "1-25"}
    out = []
    with httpx.Client(headers=headers, timeout=60) as client:
        for q in APPLICANT_QUERIES:
            r = client.get(f"{OPS}/rest-services/published-data/search/biblio", params={"q": f'pa="{q}"'})
            if r.status_code == 404:  # brak wyników
                continue
            r.raise_for_status()
            for doc in ET.fromstring(r.content).iter(f"{{{NS['ex']}}}exchange-document"):
                number = f"{doc.get('country')}{doc.get('doc-number')}{doc.get('kind')}"
                titles = {t.get("lang"): "".join(t.itertext()).strip() for t in doc.iter(f"{{{NS['ex']}}}invention-title")}
                applicants = [text(a, "ex:applicant-name/ex:name") for a in doc.iter(f"{{{NS['ex']}}}applicant")
                              if a.get("data-format") == "original"]
                abstract = next((" ".join(a.itertext()).strip() for a in doc.iter(f"{{{NS['ex']}}}abstract")), None)
                date = text(doc, ".//ex:publication-reference/ex:document-id/ex:date")
                institution = next((a for a in applicants if a and any(
                    full.lower().split()[0] in a.lower() for full in PUBLIC_UNIVERSITIES)), applicants[0] if applicants else None)
                out.append(normalize({
                    "source": "epo", "external_id": number, "kind": "patent" if doc.get("kind", "").startswith("B") else "zgloszenie_patentowe",
                    "title": titles.get("pl") or titles.get("en") or next(iter(titles.values()), number),
                    "abstract": abstract, "institution": institution,
                    "published_on": f"{date[:4]}-{date[4:6]}-{date[6:8]}" if date and len(date) == 8 else None,
                    "url": f"https://worldwide.espacenet.com/patent/search?q=pn%3D{number}", "license": LICENSE,
                }))
    return out


if __name__ == "__main__":
    key, secret = os.environ.get("EPO_OPS_KEY"), os.environ.get("EPO_OPS_SECRET")
    if key and secret:
        records = fetch(key, secret)
        save_snapshot("epo", records, real=True, license=LICENSE, note="Publikacje EPO OPS ze zgłaszającym — uczelnią publiczną regionu.")
    else:
        save_synthetic("epo", RECORDS, "EPO OPS wymaga klucza OAuth (EPO_OPS_KEY, EPO_OPS_SECRET); bez niego 403.")
