"""Migawki źródeł + cache klasyfikatora → ../supabase/seed/40_sources.sql. Bez wywołań API i LLM, wynik deterministyczny.

- source_records: wszystkie rekordy z raw/sources/<źródło>.json; klasyfikacja z raw/sources/classified.json albo null
  (wtedy oceni ją Panel → Źródła → „Skanuj źródła”). Seed nie nadpisuje klasyfikacji zrobionej już w bazie.
- search_index (kind = source_record): sprawdzanie dublowania przy zgłoszeniu (lib/sources.ts → similarSources).
- initiatives: kandydaci jako wykryte inicjatywy (status i submission_kind „detected”, nieopublikowane, bez klucza —
  klucz do przejęcia tworzy Panel). To samo rozwiązanie z kilku źródeł (np. zgłoszenie PL i odpowiednik EP) łączymy:
  kolejne dostają duplicate_of pierwszego — te same reguły co pickDuplicate w lib/source-records.ts.

Kolejność ładowania: po 30_demo.sql (który kasuje syntetyczne inicjatywy — ten plik wstawia przykładowe wykryte od nowa).

    cd data && uv run sources/sources_seed.py
"""
import json
import random
import re
import uuid

from base import SNAPSHOTS, SOURCES, gminy, load_snapshots
from common import OUT, SEED, index_row, lit
from region import STATUS_PREFIX

NS = uuid.UUID("5c1f0d7e-2b8a-4f3e-a9d1-7e0c4b6a2f19")
ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"  # jak lib/status-code.ts
SAME_SOLUTION_MIN_SIMILARITY = 0.6            # jak lib/source-records.ts
SAME_SOLUTION_MIN_STEMS = 4
GENERIC = {"metoda", "sposób", "system", "technologia", "rozwiązanie", "materiał", "produkcja", "patent", "projekt",
           "zastosowanie", "urządzenie", "układ", "method", "technology", "device"}


def uid(*parts: str) -> str:
    return str(uuid.uuid5(NS, "|".join(parts)))


def slugify(s: str) -> str:
    table = str.maketrans("ąćęłńóśźż", "acelnoszz")
    return re.sub(r"[^a-z0-9]+", "-", s.lower().translate(table)).strip("-")[:50].strip("-")


def norm(words) -> list[str]:
    return list(dict.fromkeys(w.strip().lower() for w in words if w and w.strip()))


def stem(word: str) -> str:
    """Jak stem() w lib/source-records.ts."""
    return word[:-3] if len(word) >= 7 else word[:-2] if len(word) >= 5 else word


def stems(words) -> list[str]:
    parts = [w for k in norm(words) for w in re.findall(r"[^\W\d_]+", k)]
    return list(dict.fromkeys(stem(w) for w in parts if len(w) >= 4 and w not in GENERIC))


def stems_match(a: str, b: str) -> bool:
    return a == b or (min(len(a), len(b)) >= 4 and (a.startswith(b) or b.startswith(a)))


def similarity(a, b) -> float:
    """Jak keywordSimilarity w lib/source-records.ts: część rdzeni krótszej listy z parą w dłuższej."""
    sa, sb = stems(a), stems(b)
    if not sa or not sb:
        return 0.0
    short, long = (sa, sb) if len(sa) <= len(sb) else (sb, sa)
    return sum(any(stems_match(s, x) for x in long) for s in short) / len(short)


def pick_duplicate(keywords, existing: list[tuple[str, list[str]]]) -> str | None:
    if len(stems(keywords)) < SAME_SOLUTION_MIN_STEMS:
        return None
    best = None
    for initiative_id, other in existing:
        if len(stems(other)) < SAME_SOLUTION_MIN_STEMS:
            continue
        score = similarity(keywords, other)
        if score >= SAME_SOLUTION_MIN_SIMILARITY and (best is None or score > best[1]):
            best = (initiative_id, score)
    return best[0] if best else None


def main() -> None:
    records = load_snapshots()
    cache_path = SNAPSHOTS / "classified.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    names = {g["teryt"]: g["nazwa"] for g in gminy()}
    # Kody wykrytych nie mogą trafić w kody danych demo (30_demo.sql).
    demo = OUT / "demo.json"
    used = {i["status_code"] for i in json.loads(demo.read_text(encoding="utf-8"))["initiatives"]} if demo.exists() else set()
    rng = random.Random(7007)

    lines = [
        "-- Wygenerowane przez data/sources/sources_seed.py — nie edytuj ręcznie. Rekordy z publicznych źródeł (Radar 7/10).",
        "-- Prawdziwe: Interreg. Przykładowe (synthetic = true, „(przykład)”, PRZYKLAD-…): UPRP, EPO, PBN, NCBR — patrz data/README.md.",
    ]
    detected: list[tuple[str, list[str]]] = []
    order = {s: n for n, s in enumerate(SOURCES)}
    stats = {"records": 0, "classified": 0, "candidates": 0, "duplicates": 0}
    for r in sorted(records, key=lambda r: (order[r["source"]], r["external_id"])):
        key = f"{r['source']}:{r['external_id']}"
        rid = uid("source", key)
        c = cache.get(key)
        classification = {k: c[k] for k in ("candidate", "reason", "card")} if c else None
        cols = {
            "id": rid, "source": r["source"], "external_id": r["external_id"], "kind": r["kind"], "title": r["title"],
            "abstract": r["abstract"], "institution": r["institution"], "institution_type": r["institution_type"],
            "teryt": r["teryt"] if r["teryt"] in names else None, "published_on": r["published_on"], "url": r["url"],
            "license": r["license"], "keywords": r["keywords"], "synthetic": r["synthetic"],
        }
        values = ", ".join(lit(v) for v in cols.values())
        cls = f"'{json.dumps(classification, ensure_ascii=False).replace(chr(39), chr(39) * 2)}'::jsonb" if classification else "null"
        lines.append(
            f"insert into source_records ({', '.join(cols)}, classification, classified_at) values ({values}, {cls}, "
            f"{lit(c['classifiedAt']) if c else 'null'}) on conflict (id) do update set "
            + ", ".join(f"{k} = excluded.{k}" for k in cols if k != "id")
            + ", classification = coalesce(excluded.classification, source_records.classification),"
              " classified_at = coalesce(excluded.classified_at, source_records.classified_at);")
        card = (classification or {}).get("card")
        lines.append(index_row("source_record", rid, r["title"], r["abstract"] or r["title"],
                               r["keywords"] + (card["keywords"] if card else []), domains=card["domains"] if card else [],
                               institution_type=r["institution_type"], teryt=cols["teryt"]))
        stats["records"] += 1
        stats["classified"] += bool(classification)
        if not card:
            continue

        stats["candidates"] += 1
        iid = uid("initiative", key)
        words = card["keywords"] + r["keywords"]  # karta (LLM) i rekord (źródło) razem — jak createDetectedInitiative
        duplicate_of = pick_duplicate(words, detected)
        stats["duplicates"] += bool(duplicate_of)
        if not duplicate_of:
            detected.append((iid, words))
        while True:
            code = f"{STATUS_PREFIX}-" + "".join(rng.choice(ALPHABET) for _ in range(4))
            if code not in used:
                used.add(code)
                break
        full = {**card, "municipality": names.get(cols["teryt"]), "clarity": 0.5, "followUps": []}
        row = {
            "id": iid, "status_code": code, "slug": f"{slugify(card['title'])}-{code[-4:].lower()}",
            "submission_kind": "detected", "status": "detected", "raw_text": "\n\n".join(filter(None, [r["title"], r["abstract"]])),
            "card": full, "title": card["title"], "summary": card["summary"], "domains": card["domains"],
            "institution_type": card["institutionType"] or r["institution_type"], "stage": card["stage"],
            "cross_topics": card["cross"], "innovation_kind": card["innovationKind"], "sectors": card["sectors"],
            "trl": card["trl"], "ip_status": card["ipStatus"], "teryt": cols["teryt"], "source_record_id": rid,
            "duplicate_of": duplicate_of, "published": False, "synthetic": r["synthetic"],
            "created_at": f"{r['published_on'] or '2026-11-01'}T09:00:00+00:00",
        }
        # Bez celu konfliktu: zostawiamy wiersz, który już jest (np. przejęty przez twórcę) i omijamy kolizję kodu.
        lines.append(f"insert into initiatives ({', '.join(row)}) values ({', '.join(lit(v) for v in row.values())}) on conflict do nothing;")

    SEED.mkdir(parents=True, exist_ok=True)
    (SEED / "40_sources.sql").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"supabase/seed/40_sources.sql: {stats['records']} rekordów, ocenionych {stats['classified']}, "
          f"wykrytych inicjatyw {stats['candidates']} (w tym duplikatów {stats['duplicates']})")


if __name__ == "__main__":
    main()
