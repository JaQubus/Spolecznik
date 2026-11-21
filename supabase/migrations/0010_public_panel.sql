-- Strony publiczne i Panel PCI (Radar 8/10 i 9/10): alerty dla partnerów, opiekun instytucji z RLS po institution_id,
-- przypisanie partnera do innowacji. Scalanie duplikatów używa kolumny duplicate_of z 0001, lejek z 0009.

-- ── Opiekun instytucji ──────────────────────────────────────
-- Konto z rolą 'institution' widzi w Panelu tylko innowacje swojej instytucji. Przypisuje je administrator PCI
-- (Panel → Instytucje); samodzielnie nikt nie zmienia sobie roli ani instytucji.
alter table profiles add column institution_id uuid references institutions on delete set null;
create index profiles_institution on profiles (institution_id) where institution_id is not null;
alter table profiles add constraint profiles_keeper_has_institution
  check (role <> 'institution' or institution_id is not null);

drop policy "edycja własnego profilu" on profiles;
create policy "edycja własnego profilu" on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from profiles p where p.id = auth.uid())
    and institution_id is not distinct from (select p.institution_id from profiles p where p.id = auth.uid())
  );

-- Instytucja opiekuna; null dla każdego, kto opiekunem nie jest (admin ma pełny dostęp przez is_admin()).
create function my_institution_id() returns uuid
language sql stable security definer set search_path = public as $$
  select institution_id from profiles where id = auth.uid() and role = 'institution';
$$;

create policy "opiekun instytucji" on initiatives for select
  using (institution_id is not null and institution_id = my_institution_id());
create policy "opiekun instytucji" on institutions for select
  using (id = my_institution_id());
create policy "opiekun instytucji" on initiative_creators for select
  using (exists (select 1 from initiatives i where i.id = initiative_id and i.institution_id = my_institution_id()));
create policy "opiekun instytucji" on creators for select
  using (exists (
    select 1 from initiative_creators ic join initiatives i on i.id = ic.initiative_id
    where ic.creator_id = creators.id and i.institution_id = my_institution_id()));
create policy "opiekun instytucji" on funnel_events for select
  using (exists (select 1 from initiatives i where i.id = initiative_id and i.institution_id = my_institution_id()));

-- ── Przypisanie partnera ────────────────────────────────────
-- Partner, któremu zespół PCI skierował innowację (lejek: „skierowana”). Kontakt z partnerem nadal wymaga zgody
-- obu stron (contact_requests, 0009) — to tylko wskazanie, kto ma ją przejąć.
alter table initiatives add column assigned_partner uuid references partners on delete set null;
create index initiatives_assigned_partner on initiatives (assigned_partner) where assigned_partner is not null;

-- ── Alerty dla partnerów ────────────────────────────────────
-- „Szukam innowacji do wdrożenia lub finansowania”: partner zostawia profil organizacji (tabela partners, nieaktywny
-- do zatwierdzenia przez PCI) i, jeśli chce, adres e-mail na powiadomienia o nowych innowacjach. Adres jest
-- w osobnej tabeli bez publicznego odczytu — partners ma publiczną politykę select.
create table innovation_alerts (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid references partners on delete cascade,
  email            text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  sectors          text[] not null default '{}',   -- puste = wszystkie sektory
  kinds            text[] not null default '{}',   -- klucze innovationKinds; puste = wszystkie typy
  trl_min          smallint check (trl_min between 1 and 9),
  trl_max          smallint check (trl_max between 1 and 9),
  token            text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  active           boolean not null default true,
  synthetic        boolean not null default false,
  created_at       timestamptz not null default now(),
  constraint innovation_alerts_trl_range check (trl_min is null or trl_max is null or trl_min <= trl_max)
);
create index innovation_alerts_active on innovation_alerts (active) where active;

-- Które innowacje już zgłosiliśmy w alercie: republikacja albo druga zmiana statusu nie wysyła maila drugi raz.
create table innovation_alert_deliveries (
  alert_id      uuid not null references innovation_alerts on delete cascade,
  initiative_id uuid not null references initiatives on delete cascade,
  sent_at       timestamptz not null default now(),
  primary key (alert_id, initiative_id)
);

alter table innovation_alerts           enable row level security;
alter table innovation_alert_deliveries enable row level security;
-- Bez polityk: tylko serwer (service_role). Odbiorca rezygnuje przez link z tokenem (/alerty/[token]).

-- ── Widok publiczny: etap lejka na stronie instytucji ───────
-- Kolumna na końcu, żeby create or replace view zadziałało bez usuwania widoku.
create or replace view public_initiatives as
select i.id, i.slug, i.status_code, i.title, i.summary, i.domains, i.institution_type, i.stage, i.cross_topics,
       i.innovation_kind, i.sectors, i.trl, i.ip_status,
       i.institution_id, inst.name as institution_name, inst.slug as institution_slug,
       i.teryt, left(i.teryt, 4) as county_teryt, m.name as municipality, m.county,
       i.card - array['clarity', 'followUps', 'alreadyTried'] as card,
       i.radar, coalesce(i.signal_override, i.signal) as signal, i.status,
       i.nominations_count, i.adoptions_count, i.avg_rating, i.synthetic, i.created_at, i.updated_at,
       i.pathways, i.funnel_stage
from initiatives i
left join municipalities m on m.teryt = i.teryt
left join institutions inst on inst.id = i.institution_id
where i.published and i.duplicate_of is null and i.status not in ('archived', 'detected');

-- Strona instytucji (/instytucje/[slug]) pokazuje też jej stronę internetową (dane publicznej instytucji, bez REGON).
create or replace view public_institutions as
select id, slug, name, institution_type, teryt, synthetic, website from institutions;
