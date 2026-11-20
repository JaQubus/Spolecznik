# Pipeline danych

Offline, w Pythonie (README główne, sekcja 8). Klucze bierze z `../.env.local`.

```sh
cd data
uv sync
uv run bdl.py               # profile gmin regionu (config/brand.json) z API BDL GUS (bez klucza: limity, skrypt sam czeka)
uv run seed_region.py       # gminy → ../supabase/seed/10_municipalities.sql
uv run knowledge_facts.py   # fakty „… w liczbach” z BDL → out/knowledge/facts.json (wymaga bdl_wskazniki.py --level powiat)
uv run knowledge_seed.py    # dziedziny, fakty, materiały, rozwiązania ROPS → ../supabase/seed/20_knowledge.sql + ../content/library/
uv run seed_initiatives.py  # dane demo: inicjatywy, adopcje, wyzwania, mentorzy, programy → ../supabase/seed/30_demo.sql
uv run load.py              # ładuje seed/*.sql do bazy z SUPABASE_DB_URL, w jednej transakcji
uv run usluga_wrazliwa.py   # Ramowe Plany Wdrożenia ROPS (nabory „Usługa Wrażliwa”) → out/usluga_wrazliwa.json (bez kluczy)
```

- Lokalnie wystarczy `npx supabase db reset`: stosuje migracje `0001`–`0005` i ładuje `supabase/seed/*.sql` (alfabetycznie). `load.py` robi to samo z seedami na zdalnej bazie (po `supabase db push`).
- Pliki seed są w repo i idempotentne: upsert po kluczu, dane demo (`synthetic = true`) kasowane i wstawiane od nowa. Żaden skrypt z listy nie wywołuje LLM.
- Słowniki (dziedziny, typy instytucji, etapy, tematy przekrojowe, wymiary i wagi radaru) są w `../config/taxonomy.json`; czyta je `common.py` i `lib/taxonomy.ts`. Klucz spoza słownika w seedzie = błąd od razu (`check_keys`).
- Dane demo powstają z archetypów w `templates/initiatives.json` (bez nazw prawdziwych instytucji, mentorzy i programy z dopiskiem „(przykład)”). Reguły `places` mówią, w jakich gminach archetyp może się pojawić; ten sam archetyp w kilku gminach to „podobne inicjatywy”.
- Formularz `/wniosek` czyta treść z `programs.form_schema.content`. Źródło dla programu demo: `forms/program_demo.json` (wzór fikcyjny, bez skutków prawnych). Kształt sprawdza `lib/call-schema.ts`. Szkic `/wniosek` zostaje tylko w przeglądarce.
- Generator `/wniosek-o-grant` („Usługa Wrażliwa”, #105) czyta treść wzoru z `usluga_wrazliwa_wniosek.json` (pytania, lista innowacji naboru, grupy docelowe, 22 oświadczenia; kształt sprawdza `lib/uw-content.ts`). Nowy nabór = edycja tego pliku i dopisanie innowacji do `NABORY` w `usluga_wrazliwa.py`. Ramowe Plany idą jako kontekst do planu wdrożenia i oceny szkicu, a na karcie innowacji jest link do PDF-a. Szkic wniosku zostaje w przeglądarce.

## Zasobnik wiedzy („Biblioteka i wiedza”)

Prawdziwe dane ze stron ROPS: w Radarze to „sprawdzone rozwiązania z Polski” (tabela `patterns`), ze źródłem i licencją CC BY 4.0.

```sh
uv run scrape_knowledge.py     # Biblioteka ROPS (115 innowacji, filmy, paczki ZIP), raporty, publikacje, Mapa Wyzwań → out/knowledge/
uv run knowledge_facts.py      # karty faktów „… w liczbach” policzone z BDL (gminy + powiaty) → out/knowledge/facts.json
uv run bdl_wskazniki.py        # dodatkowe wskaźniki gmin z BDL → out/gminy_wskazniki.json (bez klucza: limit 1000 zapytań / 12 h)
uv run bdl_wskazniki.py --level powiat  # te same zmienne + 3 bazowe dla powiatów → out/powiaty_wskazniki.json
uv run knowledge_map.py        # mapa: granice gmin z PRG (GUGiK, WFS) + BDL → ../public/mapa/region.json (wymaga mapshapera: npx mapshaper)
```

- Strona ROPS odpowiada na zwykłe żądania HTTP; każdy URL pobieramy raz (cache w `raw/knowledge/`, przerwa 2 s).
- Sekcję „Autorzy” pomijamy (dane osobowe). Sekcje innowacji rozpoznajemy po treści nagłówka.
- Dziedziny, typy instytucji, typ innowacji i słowa kluczowe rozwiązań przypisują reguły w `knowledge_seed.py` (`domains_auto`); admin poprawia je w Panelu, a „Odśwież indeks wyszukiwarki” liczy lepsze słowa kluczowe przez LLM.
- Mapa: opisy i kategorie wskaźników są w `map_indicators.py` (gminy: 3 bazowe + `bdl_wskazniki.py`; powiaty: te same zmienne z `bdl_wskazniki.py --level powiat`). Gminy z PRG upraszczane mapshaperem z zachowaniem topologii; powiaty i obrys województwa to scalone gminy, więc granice warstw się pokrywają. Plik ma ~140 kB (~47 kB po kompresji) i ładuje się, gdy mapa wchodzi na ekran.
- `uv run` z instalacji snap potrafi przerywać dłuższe skrypty (kod 120) — wtedy `.venv/bin/python <skrypt>.py`.

### Kondycja regionu (mapa gmin i powiatów)

- Region (prefiks TERYT, ID województwa w BDL, oczekiwana liczba gmin i powiatów, podpisy miast) jest w `../config/brand.json`; skrypty czytają go przez `region.py`. Zmiana regionu = edycja tego pliku i ponowne uruchomienie `bdl.py` → `bdl_wskazniki.py` (oba poziomy) → `knowledge_map.py` → `knowledge_facts.py`.
- Strona Kondycji (`app/(public)/biblioteka/kondycja/kondycja-view.tsx`) ma przełącznik gminy / powiaty i czyta wszystko z `../public/mapa/region.json` (`knowledge_map.py`): granice obu poziomów z PRG GUGiK, wskaźniki obu poziomów z BDL. Opisy i kategorie wskaźników są w `map_indicators.py` — kategoria bez danych na jednym poziomie jest na stronie oznaczona „tylko gminy” / „tylko powiaty”.
