-- Splot: model danych (README, sekcje 5.3 i 7)
create extension if not exists vector;

-- ── Użytkownicy ─────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        text not null default 'mieszkaniec'
              check (role in ('mieszkaniec','organizacja','jst','ekspert','admin')),
  display_name text,
  teryt       text,
  expertise   text[] not null default '{}',
  consents    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ── Dane referencyjne ───────────────────────────────────────
create table gminy (
  teryt               text primary key,
  nazwa               text not null,
  powiat              text not null,
  typ                 text check (typ in ('miejska','wiejska','miejsko-wiejska')),
  ludnosc             int,
  udzial_65plus       numeric,
  zmiana_ludnosci_10l numeric,
  wskazniki           jsonb not null default '{}'
);

create table innovations (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique,
  title          text not null,
  category       text,
  areas          text[] not null default '{}',
  target_groups  text[] not null default '{}',
  cross_topics   text[] not null default '{}',
  solution       text,
  problem        text,
  beneficiaries  text,
  who_can_use    text,
  evidence       text,
  how_to_use     text,
  components     text,
  source_url     text,
  pdf_url        text,
  video_url      text,
  etr_summary    text,             -- tekst łatwy do czytania
  tests_count    int not null default 0,
  avg_rating     numeric,
  synthetic      boolean not null default false,
  updated_at     timestamptz not null default now()
);

create table calls (               -- nabory
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  active      boolean not null default false,
  opens_at    date,
  closes_at   date,
  criteria    jsonb not null default '[]',
  form_schema jsonb not null default '{}',
  synthetic   boolean not null default false
);

-- ── Karty od użytkowników ───────────────────────────────────
create table needs (
  id            uuid primary key default gen_random_uuid(),
  status_code   text unique not null,          -- SPL-4K7Q
  author_id     uuid references auth.users,
  contact_email text,
  raw_text      text,                          -- widzi tylko autor i admin
  card          jsonb not null,                -- NeedCard (zanonimizowany)
  teryt         text references gminy,
  status        text not null default 'zgloszone'
                check (status in ('zgloszone','w_analizie','ekspert','odpowiedz','luka','zamkniete')),
  best_fit      int,
  synthetic     boolean not null default false,
  created_at    timestamptz not null default now()
);

create table matches (
  id        uuid primary key default gen_random_uuid(),
  need_id   uuid not null references needs on delete cascade,
  kind      text not null,
  ref_id    uuid not null,
  fit       int,
  why       text,
  adapt     text,
  feedback  smallint check (feedback in (-1, 1)),
  created_at timestamptz not null default now()
);

create table ideas (
  id          uuid primary key default gen_random_uuid(),
  status_code text unique not null,
  author_id   uuid references auth.users,
  need_id     uuid references needs,
  fiszka      jsonb not null default '{}',
  canvas      jsonb not null default '{}',
  stage       text,
  status      text not null default 'zgloszone',
  synthetic   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table applications (
  id         uuid primary key default gen_random_uuid(),
  idea_id    uuid not null references ideas on delete cascade,
  call_id    uuid not null references calls,
  draft      jsonb not null default '{}',
  status     text not null default 'szkic',
  created_at timestamptz not null default now()
);

create table tests (
  id            uuid primary key default gen_random_uuid(),
  innovation_id uuid not null references innovations on delete cascade,
  tester_id     uuid references auth.users,
  teryt         text references gminy,
  status        text not null default 'planowany',
  rating        smallint check (rating between 1 and 5),
  feedback      text,
  suggestions   text,
  created_at    timestamptz not null default now()
);

-- ── Komunikacja ─────────────────────────────────────────────
create table threads (
  id          uuid primary key default gen_random_uuid(),
  entity_kind text not null,
  entity_id   uuid not null,
  title       text,
  created_at  timestamptz not null default now()
);
create table thread_participants (
  thread_id uuid references threads on delete cascade,
  user_id   uuid references auth.users on delete cascade,
  primary key (thread_id, user_id)
);
create table messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references threads on delete cascade,
  author_id  uuid references auth.users,
  body       text not null,
  created_at timestamptz not null default now()
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade,
  role       text,                              -- albo do całej roli, np. 'admin'
  kind       text not null,
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ── RAG raportów ────────────────────────────────────────────
create table doc_chunks (
  id        uuid primary key default gen_random_uuid(),
  doc_title text not null,
  year      int,
  url       text,
  page      int,
  text      text not null,
  embedding vector(1536)
);
create index on doc_chunks using hnsw (embedding vector_cosine_ops);

create table audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references auth.users,
  action     text not null,
  entity     text,
  entity_id  uuid,
  diff       jsonb,
  created_at timestamptz not null default now()
);

-- ── Wspólny indeks kart (sekcja 5.3) ────────────────────────
create table search_index (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('innowacja','potrzeba','pomysl','ekspert','nabor')),
  ref_id        uuid not null,
  title         text not null,
  body          text not null,                 -- zanonimizowany tekst do embeddingu
  lemmas        text not null default '',      -- słowa kluczowe w formie podstawowej
  areas         text[] not null default '{}',
  target_groups text[] not null default '{}',
  teryt         text,
  active        boolean not null default true,
  fts           tsvector generated always as (to_tsvector('simple', title || ' ' || lemmas)) stored,
  embedding     vector(1536),
  unique (kind, ref_id)
);
create index on search_index using gin (fts);
create index on search_index using hnsw (embedding vector_cosine_ops);
create index on search_index (kind, active);

-- p_keywords budujemy w aplikacji: 'senior or samotność or "transport publiczny"'
create or replace function hybrid_search(
  p_kind text, p_keywords text, p_embedding vector(1536),
  p_count int default 15, p_rrf_k int default 50
) returns table (ref_id uuid, title text, score float)
language sql stable as $$
  with kw as (
    select id, row_number() over (
      order by ts_rank_cd(fts, websearch_to_tsquery('simple', p_keywords)) desc) as r
    from search_index
    where kind = p_kind and active
      and fts @@ websearch_to_tsquery('simple', p_keywords)
    order by r limit p_count * 2
  ),
  sem as (
    select id, row_number() over (order by embedding <=> p_embedding) as r
    from search_index
    where kind = p_kind and active and embedding is not null
    order by r limit p_count * 2
  )
  select s.ref_id, s.title,
         (coalesce(1.0 / (p_rrf_k + kw.r), 0) + coalesce(1.0 / (p_rrf_k + sem.r), 0))::float as score
  from kw
  full outer join sem on kw.id = sem.id
  join search_index s on s.id = coalesce(kw.id, sem.id)
  order by score desc
  limit p_count;
$$;

-- ── RLS ─────────────────────────────────────────────────────
-- Zapisy z aplikacji idą przez service_role w route handlers; poniżej tylko odczyty klienta.
alter table profiles            enable row level security;
alter table gminy               enable row level security;
alter table innovations         enable row level security;
alter table calls               enable row level security;
alter table needs               enable row level security;
alter table matches             enable row level security;
alter table ideas               enable row level security;
alter table applications        enable row level security;
alter table tests               enable row level security;
alter table threads             enable row level security;
alter table thread_participants enable row level security;
alter table messages            enable row level security;
alter table notifications       enable row level security;
alter table doc_chunks          enable row level security;
alter table audit_log           enable row level security;
alter table search_index        enable row level security;

create policy "publiczny odczyt" on gminy       for select using (true);
create policy "publiczny odczyt" on innovations for select using (true);
create policy "publiczny odczyt" on calls       for select using (true);
create policy "publiczny odczyt" on tests       for select using (true);
create policy "publiczny odczyt" on doc_chunks  for select using (true);

create policy "własny profil" on profiles for select using (id = auth.uid() or is_admin());
create policy "własny profil" on profiles for update using (id = auth.uid());

create policy "autor lub admin" on needs   for select using (author_id = auth.uid() or is_admin());
create policy "autor lub admin" on ideas   for select using (author_id = auth.uid() or is_admin());
create policy "admin"           on matches for select using (is_admin());
create policy "admin"           on audit_log for select using (is_admin());

create policy "uczestnik wątku" on threads for select using (
  is_admin() or exists (select 1 from thread_participants p where p.thread_id = id and p.user_id = auth.uid()));
create policy "uczestnik wątku" on messages for select using (
  is_admin() or exists (select 1 from thread_participants p where p.thread_id = messages.thread_id and p.user_id = auth.uid()));
create policy "uczestnik wątku" on messages for insert with check (
  author_id = auth.uid() and exists (select 1 from thread_participants p where p.thread_id = messages.thread_id and p.user_id = auth.uid()));
create policy "własne" on thread_participants for select using (user_id = auth.uid() or is_admin());

create policy "własne powiadomienia" on notifications for select using (
  user_id = auth.uid() or (role = 'admin' and is_admin()));
create policy "własne powiadomienia" on notifications for update using (user_id = auth.uid());

-- Realtime dla wątków i dzwonka
alter publication supabase_realtime add table messages, notifications;
