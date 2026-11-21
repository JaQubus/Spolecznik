# Pipeline danych

Offline, w Pythonie (README główne, sekcja 8). Klucze bierze z `../.env.local`.

```sh
cd data
uv sync
uv run bdl.py               # profile gmin regionu (config/brand.json) z API BDL GUS (bez klucza: limity, skrypt sam czeka)
uv run seed_region.py       # gminy → ../supabase/seed/10_municipalities.sql
uv run knowledge_facts.py   # fakty „… w liczbach” z BDL → out/knowledge/facts.json (wymaga bdl_wskazniki.py --level powiat)
uv run knowledge_seed.py    # dziedziny, fakty, materiały, rozwiązania ROPS → ../supabase/seed/20_knowledge.sql + ../content/library/
uv run seed_initiatives.py  # dane demo: instytucje, inicjatywy z twórcami, adopcje, wyzwania, mentorzy, programy, partnerzy → ../supabase/seed/30_demo.sql
uv run sources/interreg.py  # źródła Radaru (7/10): Interreg (prawdziwe), uprp/epo_ops/pbn/ncbr (migawki) → raw/sources/*.json
uv run sources/classify.py  # klasyfikator LLM → raw/sources/classified.json (cache; --limit, domyślnie 20 rekordów)
uv run sources/sources_seed.py  # migawki + cache → ../supabase/seed/40_sources.sql
uv run load.py              # ładuje seed/*.sql do bazy z SUPABASE_DB_URL, w jednej transakcji
```

- Lokalnie wystarczy `npx supabase db reset`: stosuje migracje `0001`–`0008` i ładuje `supabase/seed/*.sql` (alfabetycznie). `load.py` robi to samo z seedami na zdalnej bazie (po `supabase db push`).
- Pliki seed są w repo i idempotentne: upsert po kluczu, dane demo (`synthetic = true`) kasowane i wstawiane od nowa. Żaden skrypt z listy nie wywołuje LLM.
- Słowniki (dziedziny, typy instytucji, etapy, tematy przekrojowe, wymiary i wagi radaru, a od 4/10 także typy innowacji, sektory PCI, poziomy TRL i ich etapy, ochrona IP, role twórców, rodzaje partnerów i formy wsparcia) są w `../config/taxonomy.json`; czyta je `common.py` i `lib/taxonomy.ts`. Klucz spoza słownika w seedzie = błąd od razu (`check_keys`).
- Dane demo powstają z archetypów w `templates/initiatives.json` (bez nazw prawdziwych instytucji, mentorzy i programy z dopiskiem „(przykład)”). Reguły `places` mówią, w jakich gminach archetyp może się pojawić; ten sam archetyp w kilku gminach to „podobne inicjatywy” (`copies`, technologie z uczelni zwykle w jednym miejscu).
- Model innowacji PCI w seedzie: każdy archetyp ma typ innowacji i sektory PCI, technologiczny też TRL (generator dopasowuje go do etapu kopii) i status IP. Instytucja to typ + gmina z dopiskiem „(przykład)”, bez REGON-u i domeny (żeby nie trafić w prawdziwe). Twórcy to role z opisem, bez imion i kontaktu; podpis jest publiczny tylko za zgodą, a u ucznia także opiekuna (check w `0007`). Partnerzy (`partners` w szablonie) idą też do `search_index` jako `partner`.
- Formularz `/wniosek` czyta treść z `programs.form_schema.content`. Źródło dla programu demo: `forms/program_demo.json` (wzór fikcyjny, bez skutków prawnych). Kształt sprawdza `lib/call-schema.ts`. Szkic `/wniosek` zostaje tylko w przeglądarce.

## Źródła Radaru: automatyczne wykrywanie (7/10)

Importery w `sources/` zamieniają rekordy z publicznych źródeł na wspólny format (`sources/base.py`: źródło, identyfikator, rodzaj, tytuł, abstrakt, instytucja, typ instytucji, TERYT, data, URL, licencja, słowa kluczowe) i zapisują migawkę `raw/sources/<źródło>.json` (w repo; surowe pobrania w `raw/sources/download/` nie). Z migawek i cache klasyfikatora `sources_seed.py` robi `40_sources.sql`: tabelę `source_records`, wpisy w `search_index` (sprawdzanie dublowania) i wykryte inicjatywy (`status = submission_kind = 'detected'`, nieopublikowane). Testy bez sieci: `uv run python -m unittest discover -s sources -p 'test_*.py'` i `tests/unit/sources.test.ts`.

| Źródło | Dane | Dlaczego | Licencja / warunki |
|---|---|---|---|
| Interreg (`interreg.py`) | **prawdziwe**: wykaz projektów 2021–2027, partner wiodący — instytucja publiczna z regionu | oficjalny XLSX na interreg.gov.pl/lista-projektow | wykaz operacji z art. 49 ust. 3 rozporządzenia (UE) 2021/1060, ponowne wykorzystanie jak dla informacji sektora publicznego; warunki do potwierdzenia z instytucją zarządzającą |
| UPRP (`uprp.py`) | migawka przykładowa | e-Wyszukiwarka nie ma API i blokuje automatyczne zapytania (Incapsula); nie obchodzimy tego | docelowo umowa o ponowne wykorzystanie z UPRP albo dane PL przez EPO OPS |
| EPO OPS (`epo_ops.py`) | migawka przykładowa; z kluczem `EPO_OPS_KEY`/`EPO_OPS_SECRET` — prawdziwe | OPS wymaga darmowej rejestracji (bez klucza 403) | EPO OPS Terms and Conditions: fair use, limit tygodniowy, podanie źródła |
| PBN (`pbn.py`) | migawka przykładowa | API wymaga tokenu aplikacji (403) | do ustalenia z OPI przy dostępie do API |
| NCBR (`ncbr.py`) | migawka przykładowa | wyszukiwarka sukcesów działa w przeglądarce, bez API i eksportu | docelowo wykaz projektów FE (art. 49 CPR), jak Interreg |

Rekordy przykładowe mają `synthetic = true`, identyfikatory `PRZYKLAD-…` i „(przykład)” przy instytucji. Zawierają przypadek demo 2: zgłoszenie patentowe Politechniki Rzeszowskiej (kompozyt z odpadów włókna węglowego), jego odpowiednik w EPO i publikację w PBN — seed łączy je w jedną wykrytą inicjatywę (`duplicate_of`).

- **Filtr:** tylko instytucje publiczne z regionu — znane uczelnie publiczne (lista w `base.PUBLIC_UNIVERSITIES`, dla innego regionu trzeba ją podmienić) albo podmiot z TERYT regionu rozpoznany jako gmina, powiat, województwo, szkoła, instytucja kultury, ochrony zdrowia lub inna publiczna. Spółki, fundacje i stowarzyszenia pomijamy.
- **Dane osobowe:** importer usuwa pola z osobami (twórcy, autorzy, kontakt), a w tekście zamienia osobę z tytułem naukowym, e-mail i telefon na „[osoba]”, „[e-mail]”, „[telefon]”. Imię bez tytułu w środku zdania przejdzie — to ograniczenie wyrażenia, dlatego kartę i tak sprawdza człowiek przed publikacją.
- **Klasyfikator:** ten sam prompt w `sources/classify.py` i `classifySource` w `lib/llm.ts` (Groq, tryb JSON, walidacja zod). Status ochrony bierze z rodzaju rekordu (zgłoszenie/patent), nie z modelu. Domyślnie ocenia ~20 rekordów (darmowy limit Groq); resztę ocenia Panel → Źródła → „Skanuj źródła” po 3 rekordy.
- **Ograniczenia:** pokrycie źródeł (dziś realnie tylko Interreg), opóźnienie (dane są tak świeże jak ostatnie uruchomienie importera; wykaz Interreg odświeżany co kilka tygodni), błędy klasyfikatora (AI może uznać zwykłą inwestycję za innowację albo przeoczyć wartościowy rekord — dlatego wykryta inicjatywa jest prywatna do przejęcia przez twórcę lub weryfikacji zespołu), dublowanie liczone po słowach kluczowych (parafrazy bez wspólnych słów nie zostaną połączone), licencje źródeł do potwierdzenia przed wdrożeniem produkcyjnym.

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
