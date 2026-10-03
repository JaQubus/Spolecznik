-- Zasobnik wiedzy („Biblioteka i wiedza”): obszary Mapy Wyzwań, karty faktów, materiały,
-- prawdziwe innowacje z Biblioteki ROPS i funkcje dla widoku trendów w panelu.
-- Dane startowe: supabase/seed_knowledge.sql (generuje data/knowledge_seed.py).

-- ── Obszary (oś 1 taksonomii) ──────────────────────────────
create table areas (
  key               text primary key,             -- jak MWS_AREAS w lib/schemas.ts
  slug              text unique not null,         -- adres /biblioteka/obszar/[slug]
  name              text not null,
  icon              text not null,                -- nazwa ikony Lucide
  lead              text not null,                -- jedno zdanie na kafel
  definition        text not null,                -- 2–3 zdania prostym językiem
  challenges        jsonb not null default '[]',  -- lista zdań
  challenges_source jsonb,                        -- {title, url, note}: Mapa Wyzwań (dane ogólnopolskie)
  reading           jsonb not null default '[]',  -- raporty polecane w Mapie Wyzwań
  sort              int not null default 0,
  published         boolean not null default true,
  synthetic         boolean not null default false,
  updated_at        timestamptz not null default now()
);

-- ── Karty faktów „Małopolska w liczbach” ───────────────────
-- Fakt bez pełnego źródła musi mieć etykietę „przykład” (is_example) — inaczej się nie zapisze.
create table facts (
  id               uuid primary key default gen_random_uuid(),
  area_key         text not null references areas on delete cascade,
  value            numeric,
  unit             text,
  display_value    text not null,                 -- „841,5 tys.”, „od 1,2 do 6,1%”
  sentence         text not null,                 -- jedno zdanie prostym językiem (ręcznie lub szablonem, bez LLM)
  data_year        int,
  source_title     text,
  source_publisher text,
  source_url       text,
  source_year      int,
  source_page      int,
  quote            text,                          -- dosłowny cytat ze źródła (sprawdzany przy imporcie)
  is_example       boolean not null default false,
  sort             int not null default 0,
  published        boolean not null default true,
  updated_at       timestamptz not null default now(),
  constraint fact_has_source_or_is_example
    check (is_example or (source_title is not null and source_url is not null and source_year is not null))
);
create index on facts (area_key, sort);

-- ── Materiały edukacyjne ───────────────────────────────────
create table knowledge_materials (  -- „materials” zajęła migracja 0008 (Ucz się)
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('raport','poradnik','film','kanwa','publikacja')),
  title       text not null,
  description text,
  url         text not null,
  format      text,                               -- PDF, film…
  size_bytes  bigint,
  language    text not null default 'pl',
  areas       text[] not null default '{}',
  year        int,
  sort        int not null default 0,
  published   boolean not null default true,
  synthetic   boolean not null default false,
  updated_at  timestamptz not null default now()
);
create index on knowledge_materials using gin (areas);

-- ── Innowacje: pola historii, filmu i publikacji ───────────
-- corpus odróżnia innowacje pipeline'u matchmakingu (data/embed.py) od Biblioteki ROPS w Zasobniku,
-- żeby oba korpusy działały obok siebie, dopóki zespół nie zdecyduje o jednym.
alter table innovations
  add column corpus          text not null default 'pipeline' check (corpus in ('pipeline','biblioteka')),
  add column innovation_type text check (innovation_type in ('przedmiot','metoda','usluga','technologia')),
  add column type_auto       boolean not null default false,  -- typ przypisany regułami, do sprawdzenia
  add column areas_auto      boolean not null default false,  -- obszary przypisane regułami, do sprawdzenia
  add column video           jsonb,                           -- {youtube_id, title, thumbnail_url, sign_language, captions}
  add column materials_zip   jsonb,                           -- {url, size_bytes, link_ok}
  add column license_url     text,
  add column dissemination   boolean not null default false,  -- wybrana do upowszechniania
  add column published       boolean not null default true;
create index on innovations (corpus, published);

-- ── Wspólny indeks: nowe rodzaje kart Zasobnika ────────────
alter table search_index drop constraint search_index_kind_check;
alter table search_index add constraint search_index_kind_check
  check (kind in ('innowacja','potrzeba','pomysl','ekspert','nabor','biblioteka','obszar','material'));

-- Podobne karty po samym embeddingu („Podobne innowacje” na karcie innowacji).
create or replace function similar_cards(p_kind text, p_ref_id uuid, p_count int default 3)
returns table (ref_id uuid, title text, similarity float)
language sql stable as $$
  select s.ref_id, s.title, (1 - (s.embedding <=> me.embedding))::float
  from search_index s, (select embedding from search_index where kind = p_kind and ref_id = p_ref_id) me
  where s.kind = p_kind and s.active and s.ref_id <> p_ref_id and s.embedding is not null
  order by s.embedding <=> me.embedding
  limit p_count;
$$;

-- ── Trendy potrzeb (tylko admin: wywołuje serwer kluczem service_role po sprawdzeniu roli) ──
create or replace function need_trends(p_bucket text default 'week')
returns table (bucket date, area text, needs int)
language sql stable as $$
  select date_trunc(p_bucket, n.created_at)::date, a.area, count(*)::int
  from needs n, jsonb_array_elements_text(n.card -> 'areas') as a(area)
  where p_bucket in ('week','month')
  group by 1, 2
  order by 1, 2;
$$;

create or replace function needs_by_powiat()
returns table (powiat text, needs int)
language sql stable as $$
  select coalesce(g.powiat, 'nie podano'), count(*)::int
  from needs n left join gminy g on g.teryt = n.teryt
  group by 1
  order by 2 desc;
$$;

-- Słowa kluczowe (formy podstawowe z karty potrzeby): ostatnie p_days dni vs poprzednie p_days.
create or replace function rising_keywords(p_days int default 30, p_limit int default 15)
returns table (keyword text, recent int, previous int)
language sql stable as $$
  with k as (
    select lower(kw) as keyword, n.created_at
    from needs n, jsonb_array_elements_text(n.card -> 'keywords') as kw
    where n.created_at >= now() - make_interval(days => p_days * 2)
  )
  select keyword, recent, previous
  from (
    select keyword,
           count(*) filter (where created_at >= now() - make_interval(days => p_days))::int as recent,
           count(*) filter (where created_at <  now() - make_interval(days => p_days))::int as previous
    from k
    group by keyword
  ) t
  order by recent - previous desc, recent desc
  limit p_limit;
$$;

revoke execute on function need_trends(text), needs_by_powiat(), rising_keywords(int, int) from public, anon, authenticated;

-- ── RLS ────────────────────────────────────────────────────
alter table areas     enable row level security;
alter table facts     enable row level security;
alter table knowledge_materials enable row level security;

create policy "publiczny odczyt opublikowanych" on areas     for select using (published or is_admin());
create policy "publiczny odczyt opublikowanych" on facts     for select using (published or is_admin());
create policy "publiczny odczyt opublikowanych" on knowledge_materials for select using (published or is_admin());

drop policy "publiczny odczyt" on innovations;
create policy "publiczny odczyt opublikowanych" on innovations for select using (published or is_admin());
