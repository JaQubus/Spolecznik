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

uv run seed_innovations.py # szybki seed Biblioteki z out/innovations.json, bez embeddingów (SUPABASE_DB_URL)
uv run import_powiaty.py   # 22 powiaty × 112 wskaźników → powiaty_wskazniki (SUPABASE_DB_URL)
uv run import_powiaty.py --sql  # to samo jako out/powiaty.sql do wklejenia w SQL Editor Supabase
uv run powiaty_geo.py      # kształty powiatów (PRG GUGiK) → ../lib/powiaty-shapes.json, tylko gdy zmienią się granice
```

- Przed `embed.py` w Supabase muszą być migracje `0001`–`0004`; przed `import_powiaty.py` także `0005`, a lista „Ucz się” to migracja `0006` (materiały są w tabeli `materials`, nowy materiał = nowy wiersz).
- `embed.py` jest idempotentny: innowacje upsertuje po slugu (usuwa te spoza `out/innovations.json`), dane syntetyczne kasuje i wstawia od nowa.
- Wyniki LLM i embeddingi są cache'owane (`out/enriched.json`, `raw/*_cache.json`), więc ponowne uruchomienie płaci tylko za zmiany.
- Wszystko, co pochodzi z mocka albo z `seed_synthetic.py`, ma `synthetic = true`.
- `golden_set.jsonl` odwołuje się do slugów z mocka. Po przejściu na `--live` trzeba go napisać od nowa.

### Kondycja Małopolski (dane powiatów)

- Źródło: `../dane/powiaty/wszystkie_powiaty.csv` (eksport IOSS, rok 2024). Pliki per powiat obok to duplikaty i nie są czytane.
- `powiaty_mapping.json` to jedyne miejsce porządków: pełne nazwy obciętych arkuszy XLS (`POMOC SPOŁECZNA - P` → „powody udzielania pomocy”, `Sheet6` → „świadczenia i usługi” itd.) i jednostki dla wskaźników, które ich nie mają (np. `Stopa bezrobocia` → `%`). Nowy wskaźnik bez jednostki → import wypisze ostrzeżenie.
- Import jest idempotentny: upsert po (powiat, wskaźnik, rok); wiersze z tego samego roku, których nie ma już w pliku, są kasowane. Nowy rok = nowy CSV i ponowny import, poprzednie lata zostają.
- Które wskaźniki trafiają na mapę i jak brzmią zdania „co czwarta osoba…”, ustala `../lib/kondycja.ts`.
