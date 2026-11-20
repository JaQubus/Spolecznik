-- Radar Innowacji: model danych. Słowniki (dziedziny, typy instytucji, etapy, wymiary radaru) są w config/taxonomy.json —
-- w bazie trzymamy klucze jako text/text[] bez check, żeby zmiana słownika nie wymagała migracji.
-- Zapisy z aplikacji idą przez service_role w route handlers; polityki odczytu: 0004_rls.sql.

-- ── Użytkownicy ─────────────────────────────────────────────
create table profiles (
  id               uuid primary key references auth.users on delete cascade,
  role             text not null default 'author' check (role in ('author', 'institution', 'mentor', 'admin')),
  display_name     text,
  institution_name text,
  teryt            text,
  consents         jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Pierwszy login zakłada profil z rolą 'author'. Rolę admina/mentora nadaje się ręcznie albo w Panelu.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ── Dane referencyjne ───────────────────────────────────────
-- Gminy regionu z config/brand.json (data/bdl.py → data/load.py).
create table municipalities (
  teryt                 text primary key,
  name                  text not null,
  county                text not null,                                  -- „bieszczadzki”, „m. Rzeszów”
  county_teryt          text generated always as (left(teryt, 4)) stored,
  kind                  text check (kind in ('miejska', 'wiejska', 'miejsko-wiejska')),
  population            int,
  share_65plus          numeric,
  population_change_10y numeric,
  indicators            jsonb not null default '{}'
);
create index municipalities_name_lower on municipalities (lower(name));
create index municipalities_county on municipalities (county_teryt);

-- Sprawdzone rozwiązania z Polski (Biblioteka Innowacji Społecznych ROPS w Krakowie, ze źródłem i licencją).
create table patterns (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique,
  title             text not null,
  category          text,
  domains           text[] not null default '{}',
  cross_topics      text[] not null default '{}',
  institution_types text[] not null default '{}',   -- kto może to przenieść do siebie
  problem           text,
  solution          text,
  beneficiaries     text,
  who_can_use       text,
  evidence          text,
  how_to_use        text,
  components        text,
  etr_summary       text,                            -- tekst łatwy do czytania
  innovation_type   text check (innovation_type in ('przedmiot', 'metoda', 'usluga', 'technologia')),
  domains_auto      boolean not null default false,  -- dziedziny z reguł, do sprawdzenia w Panelu
  source_url        text,
  source_name       text,
  pdf_url           text,
  video_url         text,
  video             jsonb,                           -- {youtube_id, title, thumbnail_url, sign_language, captions}
  materials_zip     jsonb,                           -- {url, size_bytes, link_ok}
  license_url       text,
  dissemination     boolean not null default false,  -- wybrana do upowszechniania
  adoptions_count   int not null default 0,
  avg_rating        numeric,
  published         boolean not null default true,
  synthetic         boolean not null default false,
  updated_at        timestamptz not null default now()
);
create index patterns_published on patterns (published);

-- Mentorzy i eksperci PCI. profile_id: konto, którym mentor loguje się na /mentor.
create table mentors (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  bio               text not null,
  expertise         text[] not null default '{}',
  domains           text[] not null default '{}',
  institution_types text[] not null default '{}',
  profile_id        uuid unique references profiles on delete set null,
  active            boolean not null default true,
  synthetic         boolean not null default false,
  created_at        timestamptz not null default now()
);

-- Programy wsparcia i nabory PCI.
create table programs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  domains     text[] not null default '{}',
  active      boolean not null default false,
  opens_at    date,
  closes_at   date,
  criteria    jsonb not null default '[]',
  form_schema jsonb not null default '{}',   -- {fields: […]} dla generatora wniosku, {content: …} dla /wniosek
  synthetic   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── Inicjatywy (rdzeń) ──────────────────────────────────────
-- Zgłoszona przez autora (own) albo wskazana przez kogoś, kto ją zauważył (nomination).
-- Kod RAD-XXXX działa jak numer przesyłki; rozmowa wymaga jeszcze tajnego klucza (access_hash = SHA-256).
create table initiatives (
  id                uuid primary key default gen_random_uuid(),
  status_code       text unique not null,
  slug              text unique,
  submission_kind   text not null default 'own' check (submission_kind in ('own', 'nomination')),
  author_id         uuid references auth.users on delete set null,
  contact_email     text,
  access_hash       text,
  raw_text          text,                       -- widzi tylko autor i admin
  card              jsonb not null,             -- InitiativeCard (zanonimizowana)
  title             text not null,
  summary           text not null,
  domains           text[] not null default '{}',
  institution_type  text,
  stage             text,
  cross_topics      text[] not null default '{}',
  ris               text[] not null default '{}', -- inteligentne specjalizacje regionu (ustawia Panel)
  teryt             text references municipalities,
  radar             jsonb,                      -- RadarAssessment + version, model, assessedAt
  signal            smallint check (signal between 0 and 100),
  signal_override   smallint check (signal_override between 0 and 100),
  status            text not null default 'submitted'
                    check (status in ('submitted', 'in_review', 'featured', 'supported', 'scaling', 'archived')),
  assigned_mentor   uuid references mentors on delete set null,
  published         boolean not null default false,  -- publiczne dopiero po weryfikacji w Panelu
  duplicate_of      uuid references initiatives on delete set null,
  nominations_count int not null default 0,
  canvas            jsonb not null default '{}',
  poster            jsonb,
  adoptions_count   int not null default 0,
  avg_rating        numeric,
  synthetic         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index initiatives_status_signal on initiatives (status, signal desc);
create index initiatives_domains on initiatives using gin (domains);
create index initiatives_created on initiatives (created_at desc);
create index initiatives_teryt on initiatives (teryt);

-- „Szukam rozwiązania”: instytucja opisuje problem, dostaje inicjatywy i rozwiązania do przeniesienia.
-- Bez kodu i rozmowy — zapis służy wynikom i mapie „popyt bez podaży” (is_gap).
create table challenges (
  id               uuid primary key default gen_random_uuid(),
  card             jsonb not null,               -- ChallengeCard (zanonimizowana)
  raw_text         text,
  teryt            text references municipalities,
  institution_type text,
  best_fit         int,
  is_gap           boolean not null default false,
  synthetic        boolean not null default false,
  created_at       timestamptz not null default now()
);
create index challenges_created on challenges (created_at desc);

-- Wynik dopasowania z uzasadnieniem: dla inicjatywy (podobne, wzorce) albo dla wyzwania.
create table matches (
  id            uuid primary key default gen_random_uuid(),
  initiative_id uuid references initiatives on delete cascade,
  challenge_id  uuid references challenges on delete cascade,
  target_kind   text not null check (target_kind in ('initiative', 'pattern')),
  target_id     uuid not null,
  fit           int,
  why           text,
  adapt         text,
  feedback      smallint check (feedback in (-1, 1)),
  created_at    timestamptz not null default now(),
  constraint matches_one_source check ((initiative_id is null) <> (challenge_id is null))
);
create index matches_initiative on matches (initiative_id);
create index matches_challenge on matches (challenge_id);

-- Szkic wniosku do programu.
create table applications (
  id            uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references initiatives on delete cascade,
  program_id    uuid not null references programs on delete cascade,
  draft         jsonb not null default '{}',
  status        text not null default 'szkic',
  created_at    timestamptz not null default now()
);

-- „Wypróbowaliśmy u nas”: przeniesienie inicjatywy albo rozwiązania do innej gminy/instytucji i jego ocena.
create table adoptions (
  id            uuid primary key default gen_random_uuid(),
  initiative_id uuid references initiatives on delete cascade,
  pattern_id    uuid references patterns on delete cascade,
  adopter_org   text,
  teryt         text references municipalities,
  status        text not null default 'planowany',
  rating        smallint check (rating between 1 and 5),
  worked        text,
  improve       text,
  planned_for   date,
  contact_email text,
  tester_id     uuid references auth.users on delete set null,
  synthetic     boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint adoptions_one_source check ((initiative_id is null) <> (pattern_id is null))
);
create index adoptions_initiative on adoptions (initiative_id);
create index adoptions_pattern on adoptions (pattern_id);

-- „Przenieś do siebie”: plan przeniesienia dla konkretnej gminy i typu instytucji.
create table transfer_plans (
  id               uuid primary key default gen_random_uuid(),
  source_kind      text not null check (source_kind in ('initiative', 'pattern')),
  source_id        uuid not null,
  teryt            text not null references municipalities,
  institution_type text not null,
  input            jsonb not null,
  plan             jsonb not null,
  author_id        uuid references auth.users on delete set null,
  created_at       timestamptz not null default now()
);
create index transfer_plans_created on transfer_plans (created_at desc);
create index transfer_plans_source on transfer_plans (source_kind, source_id, created_at desc);

create table audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references auth.users on delete set null,
  action     text not null,
  entity     text,
  entity_id  uuid,
  diff       jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity on audit_log (entity, entity_id, created_at);

-- ── Zasobnik wiedzy ────────────────────────────────────────
-- Strony dziedzin (/wiedza/dziedzina/[slug]): opis, wyzwania regionu, polecane materiały.
create table domains (
  key               text primary key,             -- jak klucze domains w config/taxonomy.json
  slug              text unique not null,
  name              text not null,
  icon              text not null,
  lead              text not null,
  definition        text not null,
  challenges        jsonb not null default '[]',
  challenges_source jsonb,
  reading           jsonb not null default '[]',
  sort              int not null default 0,
  published         boolean not null default true,
  synthetic         boolean not null default false,
  updated_at        timestamptz not null default now()
);

-- „Region w liczbach”: fakt bez pełnego źródła musi mieć etykietę „przykład”.
create table facts (
  id               uuid primary key default gen_random_uuid(),
  domain_key       text not null references domains on delete cascade,
  value            numeric,
  unit             text,
  display_value    text not null,
  sentence         text not null,
  data_year        int,
  source_title     text,
  source_publisher text,
  source_url       text,
  source_year      int,
  source_page      int,
  quote            text,
  is_example       boolean not null default false,
  sort             int not null default 0,
  published        boolean not null default true,
  updated_at       timestamptz not null default now(),
  constraint fact_has_source_or_is_example
    check (is_example or (source_title is not null and source_url is not null and source_year is not null))
);
create index facts_domain on facts (domain_key, sort);

-- Materiały do nauki: poradniki, raporty, filmy (Zasobnik i „Ucz się” czytają tę samą tabelę).
create table materials (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  kind        text not null check (kind in ('raport', 'poradnik', 'film', 'kanwa', 'publikacja', 'strona')),
  title       text not null,
  description text not null,
  audience    text,
  url         text not null,
  format      text,
  size_bytes  bigint,
  language    text not null default 'pl',
  publisher   text,
  domains     text[] not null default '{}',
  year        int,
  sort        int not null default 100,
  published   boolean not null default true,
  synthetic   boolean not null default false,
  updated_at  timestamptz not null default now()
);
create index materials_domains on materials using gin (domains);

-- Etykiety grup podobnych inicjatyw i wyzwań w /panel/trendy (liczone wsadowo przyciskiem w Panelu).
create table cluster_labels (
  signature   text primary key,
  keywords    text[] not null,
  label       text not null,
  description text not null,
  size        int not null,
  created_at  timestamptz not null default now()
);

-- ── Wspólny indeks kart (wyszukiwanie po lematach, 0002_search.sql) ──
create table search_index (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('initiative', 'pattern', 'challenge', 'mentor', 'program', 'domain', 'material')),
  ref_id           uuid not null,
  title            text not null,
  body             text not null,                 -- zanonimizowany tekst
  lemmas           text not null default '',      -- słowa kluczowe w formie podstawowej (LLM)
  domains          text[] not null default '{}',
  tags             text[] not null default '{}',  -- etap, tematy przekrojowe
  institution_type text,
  teryt            text,
  active           boolean not null default true,
  fts              tsvector generated always as (to_tsvector('simple', title || ' ' || lemmas)) stored,
  unique (kind, ref_id)
);
create index search_index_fts on search_index using gin (fts);
create index search_index_kind on search_index (kind, active);
