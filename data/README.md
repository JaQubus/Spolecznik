# Pipeline danych

Offline, w Pythonie (README główne, sekcja 8). Klucze bierze z `../.env.local`.

```sh
cd data
uv sync
uv run scrape_library.py   # innowacje z ../dane/mock (domyślnie; --live = prawdziwa Biblioteka ROPS)
uv run bdl.py              # profile 183 gmin z API BDL GUS (bez klucza: limity, skrypt sam czeka)
uv run parse_pdfs.py       # PDF-y z raw/docs/ → taxonomy, canvas, fragmenty raportów
uv run enrich.py           # Haiku: obszary, grupy, lematy, ETR          (ANTHROPIC_API_KEY)
uv run seed_synthetic.py   # 200 potrzeb, 10 ekspertów, 2 nabory, pomysły, testy (bez API)
uv run embed.py            # embeddingi + ładowanie do Supabase          (OPENAI_API_KEY, SUPABASE_DB_URL)
uv run eval.py             # hit@3, MRR@5, wykrywanie luk                (oba klucze)
```

- Przed `embed.py` w Supabase muszą być migracje `0001`–`0004`.
- `embed.py` jest idempotentny: innowacje upsertuje po slugu (usuwa te spoza `out/innovations.json`), dane syntetyczne kasuje i wstawia od nowa.
- Wyniki LLM i embeddingi są cache'owane (`out/enriched.json`, `raw/*_cache.json`), więc ponowne uruchomienie płaci tylko za zmiany.
- Wszystko, co pochodzi z mocka albo z `seed_synthetic.py`, ma `synthetic = true`.
- `golden_set.jsonl` odwołuje się do slugów z mocka. Po przejściu na `--live` trzeba go napisać od nowa.

## Zasobnik wiedzy („Biblioteka i wiedza”)

Prawdziwe dane ze stron ROPS, osobno od korpusu matchmakingu (`out/innovations.json` zostaje bez zmian).

```sh
uv run scrape_knowledge.py     # Biblioteka ROPS (115 innowacji, filmy, paczki ZIP), raporty, publikacje, Mapa Wyzwań → out/knowledge/
uv run knowledge_facts.py      # karty faktów: każdy cytat sprawdzany na podanej stronie PDF → out/knowledge/facts.json
uv run knowledge_personas.py   # persony z Mapy Wyzwań + pasujące innowacje → out/knowledge/personas.json
uv run knowledge_seed.py       # dane dla aplikacji → ../content/knowledge/*.json i ../supabase/seed_knowledge.sql
```

- Strona ROPS odpowiada na zwykłe żądania HTTP; każdy URL pobieramy raz (cache w `raw/knowledge/`, przerwa 2 s).
- Sekcję „Autorzy” pomijamy (dane osobowe). Sekcje innowacji rozpoznajemy po treści nagłówka.
- Obszary i typ innowacji przypisują reguły (`areas_auto`, `type_auto`); admin poprawia je w panelu.
- Z bazą: migracja `0005_knowledge.sql`, potem `seed_knowledge.sql`, potem w panelu „Odśwież indeks wyszukiwarki”.
- `uv run` z instalacji snap potrafi przerywać dłuższe skrypty (kod 120) — wtedy `.venv/bin/python <skrypt>.py`.
