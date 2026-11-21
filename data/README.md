# Pipeline danych

Offline, w Pythonie (README główne, sekcja 8). Klucze bierze z `../.env.local`.

```sh
cd data
uv sync
uv run scrape_library.py   # innowacje z ../dane/mock (domyślnie; --live = prawdziwa Biblioteka ROPS)
uv run bdl.py              # profile 183 gmin z API BDL GUS (bez klucza: limity, skrypt sam czeka)
uv run parse_pdfs.py       # PDF-y z raw/docs/ → taxonomy, canvas, fragmenty raportów
uv run enrich.py           # Groq: obszary, grupy, lematy, ETR           (GROQ_API_KEY)
uv run seed_synthetic.py   # 200 potrzeb, 10 ekspertów, 2 nabory, pomysły, testy (bez API)
uv run embed.py            # ładowanie do Supabase (bez embeddingów)     (SUPABASE_DB_URL)
uv run eval.py             # hit@3, MRR@5, wykrywanie luk                (GROQ_API_KEY)

uv run seed_innovations.py # szybki seed Biblioteki z out/innovations.json, bez kluczy API (SUPABASE_DB_URL)
uv run import_powiaty.py   # 22 powiaty × 112 wskaźników → powiaty_wskazniki (SUPABASE_DB_URL)
uv run import_powiaty.py --sql  # to samo jako out/powiaty.sql do wklejenia w SQL Editor Supabase
uv run usluga_wrazliwa.py   # Ramowe Plany Wdrożenia ROPS (nabory „Usługa Wrażliwa”) → out/usluga_wrazliwa.json (bez kluczy)
```

- Przed `embed.py` w Supabase muszą być migracje `0001`–`0006`; przed `import_powiaty.py` także `0007`, a lista „Ucz się” to migracja `0008` (materiały są w tabeli `materials`, nowy materiał = nowy wiersz).
- Formularz `/wniosek` (pytania, oświadczenia, klauzule RODO) czyta treść z `calls.form_schema.content`. Źródło dla naborów demo: `iws2_formularz.json`, wstawiany przez `seed_synthetic.py` + `embed.py`. Poprawka w treści = edycja `form_schema` w bazie (np. Table Editor Supabase), bez wdrożenia; kształt sprawdza `lib/call-schema.ts`. Aktywny nabór bez `content` pokazuje „Formularz jeszcze nie jest gotowy”. Szkic `/wniosek` zostaje tylko w przeglądarce (localStorage) — dane osobowe nie trafiają do bazy.
- Generator `/wniosek-o-grant` („Usługa Wrażliwa”, #105) czyta treść wzoru z `usluga_wrazliwa_wniosek.json` (pytania, lista innowacji naboru, grupy docelowe, 22 oświadczenia; kształt sprawdza `lib/uw-content.ts`). Nowy nabór = edycja tego pliku i dopisanie innowacji do `NABORY` w `usluga_wrazliwa.py`. Ramowe Plany idą jako kontekst do planu wdrożenia i oceny szkicu, a na karcie innowacji jest link do PDF-a. Szkic wniosku zostaje w przeglądarce.
- `embed.py` jest idempotentny: innowacje upsertuje po slugu (usuwa te spoza `out/innovations.json`), dane syntetyczne kasuje i wstawia od nowa.
- Wyniki LLM są cache'owane (`out/enriched.json`, `raw/*_cache.json`), więc ponowne uruchomienie płaci tylko za zmiany.
- Wszystko, co pochodzi z mocka albo z `seed_synthetic.py`, ma `synthetic = true`.
- `golden_set.jsonl` odwołuje się do slugów z mocka. Po przejściu na `--live` trzeba go napisać od nowa.

## Zasobnik wiedzy („Biblioteka i wiedza”)

Prawdziwe dane ze stron ROPS, osobno od korpusu matchmakingu (`out/innovations.json` zostaje bez zmian).

```sh
uv run scrape_knowledge.py     # Biblioteka ROPS (115 innowacji, filmy, paczki ZIP), raporty, publikacje, Mapa Wyzwań → out/knowledge/
uv run knowledge_facts.py      # karty faktów: każdy cytat sprawdzany na podanej stronie PDF → out/knowledge/facts.json
uv run knowledge_personas.py   # persony z Mapy Wyzwań + pasujące innowacje → out/knowledge/personas.json
uv run knowledge_seed.py       # dane dla aplikacji → ../content/knowledge/*.json i ../supabase/seed_knowledge.sql
uv run bdl_wskazniki.py        # dodatkowe wskaźniki gmin z BDL → out/gminy_wskazniki.json (bez klucza: limit 1000 zapytań / 12 h)
uv run knowledge_map.py        # mapa: granice gmin z PRG (GUGiK, WFS) + BDL + IOSS → ../public/mapa/malopolska.json (wymaga mapshapera: npx mapshaper)
```

- Strona ROPS odpowiada na zwykłe żądania HTTP; każdy URL pobieramy raz (cache w `raw/knowledge/`, przerwa 2 s).
- Sekcję „Autorzy” pomijamy (dane osobowe). Sekcje innowacji rozpoznajemy po treści nagłówka.
- Obszary i typ innowacji przypisują reguły (`areas_auto`, `type_auto`); admin poprawia je w panelu.
- Z bazą: migracja `0010_knowledge.sql`, potem `seed_knowledge.sql`, potem w panelu „Odśwież indeks wyszukiwarki”.
- Mapa: opisy i kategorie wskaźników są w `map_indicators.py` (powiaty: wszystkie wskaźniki z IOSS; gminy: 3 bazowe + `bdl_wskazniki.py`). 183 gminy z PRG upraszczane mapshaperem z zachowaniem topologii; powiaty i obrys województwa to scalone gminy, więc granice warstw się pokrywają. Plik ma ~140 kB (~47 kB po kompresji) i ładuje się, gdy mapa wchodzi na ekran.
- `uv run` z instalacji snap potrafi przerywać dłuższe skrypty (kod 120) — wtedy `.venv/bin/python <skrypt>.py`.

### Kondycja Małopolski (dane powiatów)

- Źródło: `../dane/powiaty/wszystkie_powiaty.csv` (eksport IOSS, rok 2024). Pliki per powiat obok to duplikaty i nie są czytane.
- `powiaty_mapping.json` to jedyne miejsce porządków: pełne nazwy obciętych arkuszy XLS (`POMOC SPOŁECZNA - P` → „powody udzielania pomocy”, `Sheet6` → „świadczenia i usługi” itd.) i jednostki dla wskaźników, które ich nie mają (np. `Stopa bezrobocia` → `%`). Nowy wskaźnik bez jednostki → import wypisze ostrzeżenie.
- Import jest idempotentny: upsert po (powiat, wskaźnik, rok); wiersze z tego samego roku, których nie ma już w pliku, są kasowane. Nowy rok = nowy CSV i ponowny import, poprzednie lata zostają.
- Kondycja Małopolski (`app/(public)/biblioteka/kondycja/kondycja-view.tsx`) ma przełącznik gminy / powiaty i czyta wszystko z `../public/mapa/malopolska.json` (`knowledge_map.py`): granice obu poziomów z PRG GUGiK, wskaźniki gmin z BDL (`bdl.py` + `bdl_wskazniki.py` → `out/gminy_wskazniki.json`), powiatów z IOSS. Opisy i kategorie wskaźników są w `map_indicators.py` — kategoria bez danych na jednym poziomie jest na stronie oznaczona „tylko gminy” / „tylko powiaty”.
