"""Ładowanie do Supabase: innovations, search_index, doc_chunks (README sekcja 8.5).

Wejście (z poprzednich kroków): out/gminy.json, out/innovations.json, out/enriched.json,
out/pdf_sections.json, out/synthetic.json, out/doc_chunks.json.
Ładuje do Supabase przez SUPABASE_DB_URL (wymaga migracji 0001–0005).
Bez embeddingów: cały AI idzie przez Groq, który nie ma modeli embeddingów. Wyszukiwanie działa
po lematach (kolumna fts), kolumny embedding zostają puste.

Skrypt jest idempotentny: innowacje upsertuje po slugu (i usuwa te spoza korpusu),
a dane syntetyczne kasuje i wstawia od nowa.

Uruchomienie: uv run embed.py"""
import os
import sys
import uuid

import psycopg
from psycopg.types.json import Jsonb

from common import OUT, db_url, innovation_text, read_json

EXPERT_NS = uuid.UUID("5f0c8a52-3c43-4d8e-9a39-6f1f3b7f2a10")  # stałe ref_id ekspertów między uruchomieniami


def index_rows(cur, rows: list[dict]) -> None:
    """Upsert do search_index — te same kolumny co lib/search.ts upsertIndex."""
    cur.executemany(
        """insert into search_index (kind, ref_id, title, body, lemmas, areas, target_groups, teryt, active)
           values (%(kind)s, %(ref_id)s, %(title)s, %(body)s, %(lemmas)s, %(areas)s, %(target_groups)s, %(teryt)s,
                   %(active)s)
           on conflict (kind, ref_id) do update set
             title = excluded.title, body = excluded.body, lemmas = excluded.lemmas, areas = excluded.areas,
             target_groups = excluded.target_groups, teryt = excluded.teryt, active = excluded.active""",
        [{
            "teryt": None, "active": True, "areas": [], "target_groups": [], **r,
            "lemmas": " ".join(dict.fromkeys(l.strip().lower() for l in r.get("lemmas", []) if l.strip())),
        } for r in rows],
    )


def load_gminy(cur) -> set[str]:
    gminy = read_json(OUT / "gminy.json")
    cur.executemany(
        """insert into gminy (teryt, nazwa, powiat, typ, ludnosc, udzial_65plus, zmiana_ludnosci_10l, wskazniki)
           values (%(teryt)s, %(nazwa)s, %(powiat)s, %(typ)s, %(ludnosc)s, %(udzial_65plus)s, %(zmiana_ludnosci_10l)s, %(wskazniki)s)
           on conflict (teryt) do update set nazwa = excluded.nazwa, powiat = excluded.powiat, typ = excluded.typ,
             ludnosc = excluded.ludnosc, udzial_65plus = excluded.udzial_65plus,
             zmiana_ludnosci_10l = excluded.zmiana_ludnosci_10l, wskazniki = excluded.wskazniki""",
        [{**g, "wskazniki": Jsonb(g.get("wskazniki") or {})} for g in gminy],
    )
    print(f"gminy: {len(gminy)}")
    return {g["teryt"] for g in gminy}


def load_innovations(cur) -> dict[str, str]:
    innovations = read_json(OUT / "innovations.json")
    enriched = read_json(OUT / "enriched.json") if (OUT / "enriched.json").exists() else {}
    pdf = read_json(OUT / "pdf_sections.json") if (OUT / "pdf_sections.json").exists() else {}
    if not enriched:
        print("! brak out/enriched.json — innowacje bez obszarów, lematów i ETR (uruchom enrich.py)")

    rows = []
    for i in innovations:
        e, p = enriched.get(i["slug"], {}), pdf.get(i["slug"], {})
        rows.append({
            "slug": i["slug"], "title": i["title"],
            "category": (i.get("categories") or [None])[0],
            "areas": e.get("areas", []),
            "target_groups": e.get("groups") or i.get("groups", []),
            "cross_topics": e.get("cross", []),
            "solution": i.get("solution"), "problem": i.get("problem"),
            "beneficiaries": i.get("target_group"), "who_can_use": i.get("who_can_implement"),
            # Karta PDF jest pełniejsza niż sekcja „Czy to działa?” ze strony.
            "evidence": p.get("evidence") or i.get("evidence"),
            "how_to_use": p.get("how_to_use"), "components": p.get("components"),
            "source_url": i.get("url"), "pdf_url": i.get("pdf_url"), "video_url": i.get("video_url"),
            "etr_summary": e.get("etr_summary"),
            "synthetic": bool(i.get("synthetic")),
            "lemmas": e.get("lemmas") or i["title"].lower().split(),
        })

    ids: dict[str, str] = {}
    for r in rows:
        cur.execute(
            """insert into innovations (slug, title, category, areas, target_groups, cross_topics, solution, problem,
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
               returning id""",
            r,
        )
        ids[r["slug"]] = str(cur.fetchone()[0])

    # Korpus to dokładnie out/innovations.json — np. po przejściu z danych prawdziwych na mock.
    cur.execute("delete from innovations where slug is null or not (slug = any(%s))", (list(ids),))
    cur.execute("delete from search_index where kind = 'innowacja' and not (ref_id = any(%s::uuid[]))", (list(ids.values()),))

    index_rows(cur, [{
        "kind": "innowacja", "ref_id": ids[i["slug"]], "title": i["title"], "body": innovation_text(i),
        "lemmas": r["lemmas"], "areas": r["areas"], "target_groups": r["target_groups"],
    } for i, r in zip(innovations, rows)])
    print(f"innowacje: {len(rows)} (syntetyczne: {sum(r['synthetic'] for r in rows)})")
    return ids


def load_synthetic(cur, innovation_ids: dict[str, str], teryts: set[str]) -> None:
    path = OUT / "synthetic.json"
    if not path.exists():
        print("! brak out/synthetic.json — pomijam dane demo (uruchom seed_synthetic.py)")
        return
    data = read_json(path)

    # Czyścimy poprzednie dane demo (matches i applications kasują się kaskadowo).
    cur.execute("delete from search_index where kind = 'potrzeba' and ref_id in (select id from needs where synthetic)")
    cur.execute("delete from needs where synthetic")
    cur.execute("delete from search_index where kind = 'pomysl' and ref_id in (select id from ideas where synthetic)")
    cur.execute("delete from ideas where synthetic")
    cur.execute("delete from applications where call_id in (select id from calls where synthetic)")
    cur.execute("delete from search_index where kind = 'nabor' and ref_id in (select id from calls where synthetic)")
    cur.execute("delete from calls where synthetic")
    cur.execute("delete from search_index where kind = 'ekspert'")  # wszyscy eksperci w indeksie są demo
    cur.execute("delete from tests where synthetic")

    # Potrzeby — lematy z karty, jak w lib/match.ts, żeby similar_needs_kw było spójne.
    needs = [n for n in data["needs"] if n["teryt"] in teryts]
    need_ids = []
    for n in needs:
        cur.execute(
            """insert into needs (status_code, card, teryt, status, best_fit, synthetic, created_at)
               values (%s, %s, %s, %s, %s, true, %s) returning id""",
            (n["status_code"], Jsonb(n["card"]), n["teryt"], n["status"], n["best_fit"], n["created_at"]),
        )
        need_ids.append(str(cur.fetchone()[0]))
    index_rows(cur, [{
        "kind": "potrzeba", "ref_id": nid, "title": n["card"]["summary"][:140], "body": n["card"]["summary"],
        "lemmas": n["card"]["keywords"], "areas": n["card"]["areas"], "target_groups": n["card"]["groups"],
        "teryt": n["teryt"],
        # Zamknięte zgłoszenia nie liczą się do „inne gminy zgłosiły podobny problem”.
        "active": n["status"] != "zamkniete",
    } for n, nid in zip(needs, need_ids)])

    # Eksperci — tylko w indeksie (lib/match.ts czyta imię z title i opis z body).
    experts = data["experts"]
    index_rows(cur, [{
        "kind": "ekspert", "ref_id": str(uuid.uuid5(EXPERT_NS, x["name"])), "title": x["name"],
        "body": x["description"], "lemmas": x["lemmas"], "areas": x["areas"], "target_groups": x["groups"],
    } for x in experts])

    # Nabory
    call_rows = []
    for c in data["calls"]:
        cur.execute(
            """insert into calls (title, description, active, opens_at, closes_at, criteria, form_schema, synthetic)
               values (%s, %s, %s, %s, %s, %s, %s, true) returning id""",
            (c["title"], c["description"], c["active"], c["opens_at"], c["closes_at"],
             Jsonb(c["criteria"]), Jsonb(c["form_schema"])),
        )
        call_rows.append((str(cur.fetchone()[0]), c))
    index_rows(cur, [{
        "kind": "nabor", "ref_id": cid, "title": c["title"], "body": c["description"],
        "lemmas": c["lemmas"], "areas": c["areas"], "active": c["active"],
    } for cid, c in call_rows])

    # Pomysły (Pracownia sprawdza nowość tym samym indeksem)
    idea_rows = []
    for idea in data["ideas"]:
        cur.execute(
            """insert into ideas (status_code, fiszka, stage, status, synthetic, created_at)
               values (%s, %s, %s, %s, true, %s) returning id""",
            (idea["status_code"], Jsonb(idea["fiszka"]), idea["stage"], idea["status"], idea["created_at"]),
        )
        idea_rows.append((str(cur.fetchone()[0]), idea))
    index_rows(cur, [{
        "kind": "pomysl", "ref_id": iid, "title": i["fiszka"]["krotki_opis"], "body": i["fiszka"]["istota"],
        "lemmas": i["fiszka"]["krotki_opis"].lower().split(),
    } for iid, i in idea_rows])

    # Testy + przeliczenie „Przetestowano w N gminach, średnio X” na kartach innowacji
    tests = [t for t in data["tests"] if t["innovation_slug"] in innovation_ids and t["teryt"] in teryts]
    cur.executemany(
        """insert into tests (innovation_id, teryt, status, rating, feedback, suggestions, synthetic, created_at)
           values (%s, %s, %s, %s, %s, %s, true, %s)""",
        [(innovation_ids[t["innovation_slug"]], t["teryt"], t["status"], t["rating"], t["feedback"],
          t["suggestions"], t["created_at"]) for t in tests],
    )
    # Liczniki przelicza trigger z migracji 0004 (ta sama funkcja). Jawne wywołanie wyrównuje
    # dane wgrane przed migracją i od razu wywala się, gdy 0004 nie została zastosowana.
    cur.execute("select refresh_innovation_test_stats(id) from innovations")
    print(f"demo: {len(needs)} potrzeb, {len(experts)} ekspertów, {len(call_rows)} nabory, "
          f"{len(idea_rows)} pomysłów, {len(tests)} testów")


def load_doc_chunks(cur) -> None:
    path = OUT / "doc_chunks.json"
    chunks = read_json(path) if path.exists() else []
    if not chunks:
        print("doc_chunks: brak fragmentów raportów — pomijam (PDF-y do raw/docs, potem parse_pdfs.py)")
        return
    cur.execute("delete from doc_chunks")
    cur.executemany(
        "insert into doc_chunks (doc_title, year, url, page, text) values (%s, %s, %s, %s, %s)",
        [(c["doc_title"], c["year"], c["url"], c["page"], c["text"]) for c in chunks],
    )
    print(f"doc_chunks: {len(chunks)}")


def main() -> None:
    if not os.environ.get("SUPABASE_DB_URL"):
        sys.exit("Brak SUPABASE_DB_URL w ../.env.local")
    # Jedna transakcja: w razie błędu baza zostaje w poprzednim, spójnym stanie.
    with psycopg.connect(db_url()) as conn, conn.cursor() as cur:
        teryts = load_gminy(cur)
        ids = load_innovations(cur)
        load_synthetic(cur, ids, teryts)
        load_doc_chunks(cur)
    print("Gotowe.")


if __name__ == "__main__":
    main()
