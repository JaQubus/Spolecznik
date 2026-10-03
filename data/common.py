"""Wspólne helpery pipeline'u. Konfiguracja z ../.env.local (te same klucze co aplikacja)."""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).parent
RAW = ROOT / "raw"    # surowy HTML/PDF — pobieramy raz, nie odpytujemy ROPS ponownie
OUT = ROOT / "out"    # przetworzone JSON-y gotowe do załadowania
load_dotenv(ROOT.parent / ".env.local")

HAIKU = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-5-5"
EMBEDDING_MODEL = "text-embedding-3-small"  # wymiar 1536, jak w migracji


# Taksonomia dwuosiowa — kopia lib/taxonomy.ts (klucze muszą się zgadzać z lib/schemas.ts).
AREAS = {
    "rodzina_piecza": "Rodzina i piecza zastępcza",
    "bezdomnosc": "Bezdomność",
    "niepelnosprawnosc": "Niepełnosprawność",
    "ubostwo": "Ubóstwo",
    "cudzoziemcy": "Integracja cudzoziemców",
    "zdrowie": "Zdrowie",
    "zdrowie_psychiczne": "Zdrowie psychiczne",
    "seniorzy": "Seniorzy",
}
GROUPS = {
    "seniorzy": "Dla seniorów",
    "dzieci_mlodziez_rodzina": "Dla dzieci, młodzieży i rodziny",
    "ograniczona_mobilnosc": "Dla osób o ograniczonej mobilności",
    "niepelnosprawnosc_sensoryczna": "Dla osób z niepełnosprawnością sensoryczną",
    "zdrowie_medycyna": "Dla zdrowia i medycyny",
    "rynek_pracy": "Dla rynku pracy",
    "cudzoziemcy": "Dla cudzoziemców",
    "bezdomnosc": "Dla osób w kryzysie bezdomności",
    "niepelnosprawnosc_intelektualna": "Dla osób z niepełnosprawnością intelektualną",
}
CROSS = {
    "samotnosc": "Samotność",
    "wykluczenie_cyfrowe": "Wykluczenie cyfrowe",
    "dostep_do_uslug": "Dostęp do usług społecznych",
    "depopulacja_suburbanizacja": "Depopulacja i suburbanizacja",
    "wspolpraca_miedzysektorowa": "Koordynacja międzysektorowa",
}


def taxonomy_prompt() -> str:
    fmt = lambda d: "; ".join(f"{k} = {v}" for k, v in d.items())  # noqa: E731
    return f"Obszary (areas): {fmt(AREAS)}\nGrupy (groups): {fmt(GROUPS)}\nTematy przekrojowe (cross): {fmt(CROSS)}"


def innovation_text(i: dict) -> str:
    """Tekst innowacji do embeddingu i reranku — ten sam w embed.py i eval.py."""
    parts = [
        i["title"],
        i.get("solution"),
        f"Problem: {i['problem']}" if i.get("problem") else None,
        f"Dla kogo: {i['target_group']}" if i.get("target_group") else None,
        f"Kto może wdrożyć: {i['who_can_implement']}" if i.get("who_can_implement") else None,
    ]
    return "\n".join(p for p in parts if p)


def innovation_row(i: dict, enriched: dict, pdf: dict) -> dict:
    """Wiersz tabeli innovations z out/innovations.json + wzbogacenia (enrich.py) + karty PDF (parse_pdfs.py)."""
    return {
        "slug": i["slug"], "title": i["title"],
        "category": (i.get("categories") or [None])[0],
        "areas": enriched.get("areas", []),
        "target_groups": enriched.get("groups") or i.get("groups", []),
        "cross_topics": enriched.get("cross", []),
        "solution": i.get("solution"), "problem": i.get("problem"),
        "beneficiaries": i.get("target_group"), "who_can_use": i.get("who_can_implement"),
        # Karta PDF jest pełniejsza niż sekcja „Czy to działa?” ze strony.
        "evidence": pdf.get("evidence") or i.get("evidence"),
        "how_to_use": pdf.get("how_to_use"), "components": pdf.get("components"),
        "source_url": i.get("url"), "pdf_url": i.get("pdf_url"), "video_url": i.get("video_url"),
        "etr_summary": enriched.get("etr_summary"),
        "synthetic": bool(i.get("synthetic")),
        "lemmas": enriched.get("lemmas") or i["title"].lower().split(),
    }


# Upsert po slugu — wspólny dla embed.py i seed_innovations.py.
INNOVATION_UPSERT = """insert into innovations (slug, title, category, areas, target_groups, cross_topics, solution, problem,
     beneficiaries, who_can_use, evidence, how_to_use, components, source_url, pdf_url, video_url,
     etr_summary, synthetic, updated_at)
   values (%(slug)s, %(title)s, %(category)s, %(areas)s, %(target_groups)s, %(cross_topics)s, %(solution)s,
     %(problem)s, %(beneficiaries)s, %(who_can_use)s, %(evidence)s, %(how_to_use)s, %(components)s,
     %(source_url)s, %(pdf_url)s, %(video_url)s, %(etr_summary)s, %(synthetic)s, now())
   on conflict (slug) do update set title = excluded.title, category = excluded.category,
     areas = excluded.areas, target_groups = excluded.target_groups, cross_topics = excluded.cross_topics,
     solution = excluded.solution, problem = excluded.problem, beneficiaries = excluded.beneficiaries,
     who_can_use = excluded.who_can_use, evidence = excluded.evidence, how_to_use = excluded.how_to_use,
     components = excluded.components, source_url = excluded.source_url, pdf_url = excluded.pdf_url,
     video_url = excluded.video_url, etr_summary = excluded.etr_summary, synthetic = excluded.synthetic,
     updated_at = now()
   returning id"""


def db_url() -> str:
    return os.environ["SUPABASE_DB_URL"]


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))
