-- Ścieżki rozwoju, kontakt z partnerami i lejek (Radar 6/10).
-- Ścieżki (wdrożenie, komercjalizacja, dalszy rozwój, ochrona IP, upowszechnienie) liczy kod z reguł w
-- config/taxonomy.json (lib/pathways/), więc w bazie trzymamy tylko to, czego nie da się policzyć: uzasadnienie od
-- modelu, prośby o kontakt ze zgodami obu stron i historię lejka.

-- ── Uzasadnienie ścieżek i etap lejka ───────────────────────
alter table initiatives
  add column pathways     jsonb,  -- StoredPathways (lib/schemas.ts): uzasadnienie, kroki i mierniki od modelu
  add column funnel_stage text;   -- klucz funnel (config/taxonomy.json); zmienia go advance_funnel()

-- Stan wyjściowy z tego, co już wiemy. Panel (9/10) doprecyzuje lejek; od teraz przesuwa go advance_funnel().
update initiatives set funnel_stage = case
  when status = 'detected' then 'wykryta'
  when status = 'archived' then 'zarchiwizowana'
  when radar is not null then 'oceniona'
  when published then 'zweryfikowana'
end;
create index initiatives_funnel on initiatives (funnel_stage);

-- Nowe wiersze (zgłoszenia, import ze źródeł, seedy demo ładowane po migracjach) dostają etap od razu.
create function initiatives_funnel_default() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.funnel_stage is null then
    new.funnel_stage := case when new.status = 'detected' then 'wykryta' when new.radar is not null then 'oceniona' end;
  end if;
  return new;
end $$;
create trigger initiatives_funnel_default before insert on initiatives
  for each row execute function initiatives_funnel_default();

-- ── Historia lejka ──────────────────────────────────────────
-- Każde przejście (także takie, które nie przesuwa etapu, np. druga prośba o kontakt) zostaje w historii.
create table funnel_events (
  id            bigint generated always as identity primary key,
  initiative_id uuid not null references initiatives on delete cascade,
  stage         text not null,                     -- klucz funnel
  source        text not null check (source in ('system', 'author', 'panel')),
  ref_id        uuid,                              -- np. contact_requests.id
  note          text check (char_length(note) <= 500),
  actor_id      uuid references auth.users on delete set null,
  created_at    timestamptz not null default now()
);
create index funnel_events_initiative on funnel_events (initiative_id, created_at);

-- Przesuwa lejek tylko do przodu (kolejność jak w config/taxonomy.json → funnel) i zawsze zapisuje zdarzenie.
-- Zwraca true, gdy etap się zmienił.
create function advance_funnel(
  p_initiative uuid, p_stage text, p_source text, p_ref uuid default null, p_note text default null, p_actor uuid default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  stages constant text[] := array['wykryta', 'zweryfikowana', 'oceniona', 'skierowana', 'w_realizacji', 'wdrozona', 'skomercjalizowana', 'zarchiwizowana'];
  current_stage text;
begin
  if array_position(stages, p_stage) is null then
    raise exception 'Nieznany etap lejka: %', p_stage;
  end if;
  select funnel_stage into current_stage from initiatives where id = p_initiative for update;
  if not found then
    return false;
  end if;
  insert into funnel_events (initiative_id, stage, source, ref_id, note, actor_id)
  values (p_initiative, p_stage, p_source, p_ref, left(p_note, 500), p_actor);
  if current_stage is null or array_position(stages, p_stage) > array_position(stages, current_stage) then
    update initiatives set funnel_stage = p_stage where id = p_initiative;
    return true;
  end if;
  return false;
end $$;
revoke execute on function advance_funnel(uuid, text, text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function advance_funnel(uuid, text, text, uuid, text, uuid) to service_role;

-- ── Prośby o kontakt z partnerem ────────────────────────────
-- „Poproś o kontakt” wymaga zgody obu stron. Twórca zgadza się po kluczu zgłoszenia (bez konta), zgodę partnera
-- zapisuje zespół PCI, który z partnerem rozmawia (partnerzy nie mają jeszcze kont). Dopiero po obu zgodach
-- zespół otwiera rozmowę w wątku inicjatywy — do tego czasu partner nie widzi zgłoszenia, a twórca nie dostaje
-- danych partnera. Odmowa którejkolwiek strony zamyka prośbę.
create table contact_requests (
  id                 uuid primary key default gen_random_uuid(),
  initiative_id      uuid not null references initiatives on delete cascade,
  partner_id         uuid not null references partners on delete cascade,
  pathway            text,                                   -- klucz pathways: w jakiej ścieżce partner pomoże
  initiated_by       text not null check (initiated_by in ('author', 'pci')),
  author_consent_at  timestamptz,
  partner_consent_at timestamptz,
  status             text not null default 'oczekuje' check (status in ('oczekuje', 'polaczone', 'odrzucone')),
  declined_by        text check (declined_by in ('author', 'partner')),
  thread_id          uuid references threads on delete set null,
  synthetic          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (initiative_id, partner_id),
  constraint contact_requests_both_consents check (status <> 'polaczone' or (author_consent_at is not null and partner_consent_at is not null)),
  constraint contact_requests_declined check ((status = 'odrzucone') = (declined_by is not null))
);
create index contact_requests_open on contact_requests (status, created_at) where status = 'oczekuje';
create index contact_requests_partner on contact_requests (partner_id);

alter table contact_requests enable row level security;
alter table funnel_events    enable row level security;
-- Zapisy idą przez serwer (service_role). Odczyt: admin; twórca widzi swoje prośby przez serwer po kluczu zgłoszenia.
create policy "admin" on contact_requests for select using (is_admin());
create policy "admin" on funnel_events for select using (is_admin());

-- ── Widok publiczny: uzasadnienie ścieżek na karcie innowacji ──
-- Kolumna na końcu, żeby create or replace view zadziałało bez usuwania widoku.
create or replace view public_initiatives as
select i.id, i.slug, i.status_code, i.title, i.summary, i.domains, i.institution_type, i.stage, i.cross_topics,
       i.innovation_kind, i.sectors, i.trl, i.ip_status,
       i.institution_id, inst.name as institution_name, inst.slug as institution_slug,
       i.teryt, left(i.teryt, 4) as county_teryt, m.name as municipality, m.county,
       i.card - array['clarity', 'followUps', 'alreadyTried'] as card,
       i.radar, coalesce(i.signal_override, i.signal) as signal, i.status,
       i.nominations_count, i.adoptions_count, i.avg_rating, i.synthetic, i.created_at, i.updated_at,
       i.pathways
from initiatives i
left join municipalities m on m.teryt = i.teryt
left join institutions inst on inst.id = i.institution_id
where i.published and i.duplicate_of is null and i.status not in ('archived', 'detected');
