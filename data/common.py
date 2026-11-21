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
RAW = ROOT / "raw"    # surowy HTML/PDF — pobieramy raz, nie odpytujemy źródeł ponownie
OUT = ROOT / "out"    # przetworzone JSON-y gotowe do załadowania
load_dotenv(ROOT.parent / ".env.local")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_FAST = "openai/gpt-oss-120b"     # jak models.fast w lib/llm.ts (20b psuł polskie lematy)
GROQ_QUALITY = "openai/gpt-oss-120b"  # jak models.quality w lib/llm.ts


# Słowniki z ../config/taxonomy.json — ten sam plik czyta aplikacja (lib/taxonomy.ts).
TAXONOMY = json.loads((ROOT.parent / "config" / "taxonomy.json").read_text(encoding="utf-8"))
DOMAINS: dict[str, dict] = TAXONOMY["domains"]
INSTITUTION_TYPES: dict[str, dict] = TAXONOMY["institutionTypes"]
STAGES: dict[str, dict] = TAXONOMY["stages"]
CROSS: dict[str, dict] = TAXONOMY["cross"]
RADAR: dict = TAXONOMY["radar"]


def taxonomy_prompt() -> str:
    """Słowniki do promptu: klucz = etykieta (opis) — jak TAXONOMY w lib/llm.ts."""
    fmt = lambda d: "; ".join(f"{k} = {v['label']} ({v['description']})" for k, v in d.items())  # noqa: E731
    return "\n".join([
        f"Dziedziny (domains): {fmt(DOMAINS)}",
        f"Typy instytucji (institutionType): {fmt(INSTITUTION_TYPES)}",
        f"Etapy (stage): {fmt(STAGES)}",
        f"Tematy przekrojowe (cross): {fmt(CROSS)}",
    ])


def check_keys(kind: str, keys, allowed: dict) -> None:
    """Seed z kluczem spoza słownika = błąd od razu, a nie pusta etykieta w aplikacji."""
    bad = [k for k in ([keys] if isinstance(keys, str) else keys) if k not in allowed]
    if bad:
        raise ValueError(f"Nieznane klucze {kind}: {bad}")


# ── SQL dla plików seed (supabase/seed/*.sql) ──

class Jsonb:
    """Wartość do kolumny jsonb (lista napisów domyślnie idzie jako text[])."""
    def __init__(self, value):
        self.value = value


def lit(v) -> str:
    if isinstance(v, Jsonb):
        return "'" + json.dumps(v.value, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (dict, list)) and not (isinstance(v, list) and all(isinstance(x, str) for x in v)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    if isinstance(v, list):
        return "array[" + ",".join(lit(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    return "'" + str(v).replace("'", "''") + "'"


def upsert(table: str, key: str, row: dict) -> str:
    cols = list(row)
    sets = ", ".join(f"{c} = excluded.{c}" for c in cols if c != key)
    return f"insert into {table} ({', '.join(cols)}) values ({', '.join(lit(row[c]) for c in cols)}) on conflict ({key}) do update set {sets};"


def index_row(kind: str, ref_id: str, title: str, body: str, lemmas, *, domains=(), tags=(), institution_type=None,
              teryt=None, active=True) -> str:
    """Wiersz search_index — te same kolumny co lib/search.ts upsertIndex."""
    words = " ".join(dict.fromkeys(w.strip().lower() for w in lemmas if w and w.strip()))
    return (f"insert into search_index (kind, ref_id, title, body, lemmas, domains, tags, institution_type, teryt, active) values "
            f"({lit(kind)}, {lit(ref_id)}, {lit(title)}, {lit(body)}, {lit(words)}, {lit(list(domains))}, {lit(list(tags))}, "
            f"{lit(institution_type)}, {lit(teryt)}, {lit(active)}) on conflict (kind, ref_id) do update set title = excluded.title, "
            f"body = excluded.body, lemmas = excluded.lemmas, domains = excluded.domains, tags = excluded.tags, "
            f"institution_type = excluded.institution_type, teryt = excluded.teryt, active = excluded.active;")


SEED = ROOT.parent / "supabase" / "seed"   # supabase db reset ładuje seed/*.sql alfabetycznie; load.py robi to samo zdalnie


def db_url() -> str:
    return os.environ["SUPABASE_DB_URL"]


def groq_chat(messages: list[dict], *, model: str = GROQ_FAST, json_mode: bool = False, temperature: float = 0.5) -> str:
    """Jedno wywołanie Groq (API zgodne z OpenAI). Przy 429, błędach serwera i zerwanym połączeniu czeka i ponawia.

    Darmowy plan ma 8 tys. tokenów na minutę na cały klucz, a aplikacja korzysta z tego samego klucza —
    stąd do 12 prób (łącznie do ok. 10 minut czekania), zanim skrypt się podda."""
    response = None
    for attempt in range(12):
        try:
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
        except httpx.TransportError:  # „Server disconnected without sending a response” w trakcie długiego przebiegu
            time.sleep(min(2 ** attempt, 60))
            continue
        if response.status_code == 429 and "tokens per day" in response.text:
            # Dzienny limit (200 tys. tokenów) w oknie kroczącym 24 h — czekanie minutami nic nie da.
            # Wyniki zapisane w cache przetrwają, więc po zwolnieniu limitu skrypt wznowi się od tego miejsca.
            raise RuntimeError(f"Groq: wyczerpany dzienny limit tokenów. {response.json()['error']['message']}")
        if response.status_code == 429 or response.status_code >= 500:
            time.sleep(min(max(float(response.headers.get("retry-after", 0)), 2 ** attempt), 60))
            continue
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    if response is not None:
        response.raise_for_status()
    raise RuntimeError(f"Groq: {response.status_code if response is not None else 'brak odpowiedzi'} po {attempt + 1} próbach")


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
