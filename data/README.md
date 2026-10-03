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
