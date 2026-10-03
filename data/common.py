"""Wspólne helpery pipeline'u. Konfiguracja z ../.env.local (te same klucze co aplikacja)."""
import json
import os
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).parent
RAW = ROOT / "raw"    # surowy HTML/PDF — pobieramy raz, nie odpytujemy ROPS ponownie
OUT = ROOT / "out"    # przetworzone JSON-y gotowe do załadowania
load_dotenv(ROOT.parent / ".env.local")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_FAST = "openai/gpt-oss-120b"     # jak models.fast w lib/llm.ts (20b psuł polskie lematy)
GROQ_QUALITY = "openai/gpt-oss-120b"  # jak models.quality w lib/llm.ts
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


def db_url() -> str:
    return os.environ["SUPABASE_DB_URL"]


def groq_chat(messages: list[dict], *, model: str = GROQ_FAST, json_mode: bool = False, temperature: float = 0.5) -> str:
    """Jedno wywołanie Groq (API zgodne z OpenAI). Przy 429 i błędach serwera czeka i ponawia."""
    for attempt in range(6):
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
        if response.status_code == 429 or response.status_code >= 500:
            time.sleep(min(float(response.headers.get("retry-after", 2 ** attempt)), 60))
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
