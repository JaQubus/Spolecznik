"""Wspólne helpery pipeline'u. Konfiguracja z ../.env.local (te same klucze co aplikacja)."""
import json
import os
import time
from pathlib import Path

import httpx
import truststore
from dotenv import load_dotenv

# Certyfikaty z systemu (Windows/macOS), nie tylko z certifi — inaczej HTTPS pada
# za antywirusem albo proxy, które podmienia certyfikaty.
truststore.inject_into_ssl()

ROOT = Path(__file__).parent
RAW = ROOT / "raw"    # surowy HTML/PDF — pobieramy raz, nie odpytujemy ROPS ponownie
OUT = ROOT / "out"    # przetworzone JSON-y gotowe do załadowania
load_dotenv(ROOT.parent / ".env.local")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_FAST = "openai/gpt-oss-120b"     # jak models.fast w lib/llm.ts (20b psuł polskie lematy)
GROQ_QUALITY = "openai/gpt-oss-120b"  # jak models.quality w lib/llm.ts


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


def groq_chat(messages: list[dict], *, model: str = GROQ_FAST, json_mode: bool = False, temperature: float = 0.5) -> str:
    """Jedno wywołanie Groq (API zgodne z OpenAI). Przy 429 i błędach serwera czeka i ponawia.

    Darmowy plan ma 8 tys. tokenów na minutę na cały klucz, a aplikacja korzysta z tego samego klucza —
    stąd do 12 prób (łącznie do ok. 10 minut czekania), zanim skrypt się podda."""
    for attempt in range(12):
        response = httpx.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}"},
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": 4096,  # obejmuje też tokeny rozumowania
                **({"response_format": {"type": "json_object"}} if json_mode else {}),
                # gpt-oss to modele rozumujące: krótkie rozumowanie i bez jego treści w odpowiedzi.
                **({"reasoning_effort": "low", "include_reasoning": False} if model.startswith("openai/gpt-oss") else {}),
            },
            timeout=120,
        )
        if response.status_code == 429 and "tokens per day" in response.text:
            # Dzienny limit (200 tys. tokenów) w oknie kroczącym 24 h — czekanie minutami nic nie da.
            # Wyniki zapisane w cache przetrwają, więc po zwolnieniu limitu skrypt wznowi się od tego miejsca.
            raise RuntimeError(f"Groq: wyczerpany dzienny limit tokenów. {response.json()['error']['message']}")
        if response.status_code == 429 or response.status_code >= 500:
            time.sleep(min(max(float(response.headers.get("retry-after", 0)), 2 ** attempt), 60))
            continue
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    response.raise_for_status()
    raise RuntimeError(f"Groq: {response.status_code} po {attempt + 1} próbach")


def groq_json(system: str, schema: dict, prompt: str, *, model: str = GROQ_FAST) -> dict:
    """Obiekt JSON zgodny ze schematem — odpowiednik groqObject z lib/groq.ts.

    Tryb JSON nie gwarantuje schematu, więc przy brakujących polach raz prosimy model o poprawkę.
    Wartości (enumy, długości list) i tak waliduje kod wywołujący."""
    messages = [
        {"role": "system", "content": f"{system}\n\nOdpowiadasz wyłącznie jednym obiektem JSON zgodnym z tym JSON Schema "
                                      f"(klucze i wartości wyliczeniowe dokładnie jak w schemacie):\n{json.dumps(schema, ensure_ascii=False)}"},
        {"role": "user", "content": prompt},
    ]
    for attempt in range(2):
        raw = groq_chat(messages, model=model, json_mode=True)
        try:
            out = json.loads(raw)
            missing = [k for k in schema.get("required", []) if k not in out]
            if not missing:
                return out
            problem = f"brak pól: {', '.join(missing)}"
        except json.JSONDecodeError:
            problem = "to nie jest poprawny JSON"
        messages += [{"role": "assistant", "content": raw},
                     {"role": "user", "content": f"Odpowiedź nie pasuje do schematu: {problem}. Zwróć poprawiony obiekt JSON."}]
    raise RuntimeError(f"Groq: odpowiedź niezgodna ze schematem ({problem})")


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))
