-- Raport gminy (#104): wyniki LLM liczone z wyprzedzeniem, żeby strona raportu nie czekała na model.
-- Liczby raportu liczy kod przy każdym wyświetleniu (lib/gmina-report/score.ts) — tu są tylko teksty i dopasowania.
-- Zapisuje lib/gmina-report/rebuild.ts kluczem service_role (POST /api/raporty-gmin, scripts/raporty-gmin.mjs).

-- Podsumowanie raportu: zdania z modelu po sprawdzeniu liczb albo zdania z szablonu.
create table if not exists gmina_reports (
  teryt          text primary key references gminy on delete cascade,
  summary        text not null,
  summary_source text not null check (summary_source in ('llm', 'szablon')),
  data_version   text not null,      -- skrót danych wejściowych; inny = do przeliczenia
  generated_at   timestamptz not null default now()
);

-- Innowacje dla obszaru Mapy Wyzwań w grupie porównawczej gmin (np. „wiejska:5do15”). Rerank nie zależy od
-- konkretnej gminy (README §5.1), więc liczymy go raz na grupę: ok. 50 wywołań zamiast ponad 500.
create table if not exists gmina_report_matches (
  area          text not null,
  cohort        text not null,
  items         jsonb not null default '[]',  -- [{id, fit, why, adapt}] z rerank(), adapt po sprawdzeniu liczb albo null
  data_version  text not null,
  generated_at  timestamptz not null default now(),
  primary key (area, cohort)
);

-- Bez danych osobowych: podsumowanie z danych publicznych (GUS, IOSS), dopasowania do Biblioteki.
alter table gmina_reports enable row level security;
alter table gmina_report_matches enable row level security;
create policy "publiczny odczyt" on gmina_reports for select using (true);
create policy "publiczny odczyt" on gmina_report_matches for select using (true);
