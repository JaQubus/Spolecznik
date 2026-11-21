-- Model innowacji pod PCI (Radar 4/10): typ innowacji, sektory PCI, TRL, ochrona IP, instytucje, twórcy i partnerzy.
-- Słowniki (innovationKinds, sectors, ipStatuses, creatorRoles, partnerKinds, partnerSupport) są w config/taxonomy.json;
-- jak w 0001, klucze trzymamy jako text/text[] bez check, żeby zmiana słownika nie wymagała migracji.

-- ── Instytucje: szkoła, uczelnia, urząd, szpital… Podstawa pracy wielu organizacji w jednym Radarze ──
-- Dane publicznych instytucji (nazwa, REGON, siedziba), bez danych osób. email_domain pozwoli w 9/10 przypiąć
-- konto opiekuna do instytucji po adresie służbowym.
create table institutions (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  name             text not null,
  institution_type text not null,                 -- klucz institutionTypes
  regon            text unique check (regon ~ '^(\d{9}|\d{14})$'),
  teryt            text references municipalities,
  email_domain     text unique check (email_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  website          text,
  synthetic        boolean not null default false,
  created_at       timestamptz not null default now()
);
create index institutions_teryt on institutions (teryt);

-- ── Nowe pola inicjatywy ────────────────────────────────────
-- ris (ręczne inteligentne specjalizacje) zastępują sektory PCI ze słownika; widok public_initiatives
-- zależy od tej kolumny, więc tworzymy go od nowa niżej.
drop view public_initiatives;
alter table initiatives drop column ris;

alter table initiatives
  add column innovation_kind text,                       -- klucz innovationKinds
  add column sectors         text[] not null default '{}', -- klucze sectors
  add column trl             smallint check (trl between 1 and 9),
  add column ip_status       text,                        -- klucz ipStatuses
  add column institution_id  uuid references institutions on delete set null,
  -- TRL opisuje gotowość technologii — dla innowacji organizacyjnej czy edukacyjnej nie ma sensu.
  add constraint initiatives_trl_only_technological check (trl is null or innovation_kind = 'technologiczna');

create index initiatives_sectors on initiatives using gin (sectors);
create index initiatives_institution on initiatives (institution_id);
create index initiatives_kind on initiatives (innovation_kind);

-- ── Twórcy ──────────────────────────────────────────────────
-- Osoba albo zespół („uczniowie klasy 3T”). Bez danych kontaktowych: kontakt idzie przez wątek inicjatywy
-- (kod i klucz zgłoszenia). display_name jest opcjonalny i publiczny tylko za zgodą (show_publicly);
-- dla osób poniżej 18 lat potrzebna jest też zgoda opiekuna (RODO, art. 8).
create table creators (
  id               uuid primary key default gen_random_uuid(),
  role             text not null,                  -- klucz creatorRoles
  display_name     text check (char_length(display_name) <= 120),
  under_18         boolean not null default false,
  guardian_consent boolean not null default false,
  show_publicly    boolean not null default false,
  institution_id   uuid references institutions on delete set null,
  profile_id       uuid references profiles on delete set null,  -- konto twórcy, jeśli je założy
  synthetic        boolean not null default false,
  created_at       timestamptz not null default now(),
  constraint creators_minor_needs_guardian check (not (under_18 and show_publicly and not guardian_consent))
);

create table initiative_creators (
  initiative_id uuid not null references initiatives on delete cascade,
  creator_id    uuid not null references creators on delete cascade,
  sort          smallint not null default 0,
  primary key (initiative_id, creator_id)
);
create index initiative_creators_creator on initiative_creators (creator_id);

-- ── Partnerzy: kto może wdrożyć, rozwijać albo finansować innowację ──
-- Firmy, fundusze, CTT uczelni, akceleratory i laboratoria PCI, samorządy jako odbiorcy. Dopasowanie (6/10)
-- porównuje sektory, dziedziny, formy wsparcia i dojrzałość (TRL albo etap) z kartą innowacji.
create table partners (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  kind         text not null,                      -- klucz partnerKinds
  description  text not null,
  sectors      text[] not null default '{}',       -- klucze sectors
  domains      text[] not null default '{}',       -- klucze domains
  support      text[] not null default '{}',       -- klucze partnerSupport: licencja, inwestycja, pilotaz, zakup, mentoring
  trl_min      smallint check (trl_min between 1 and 9),
  trl_max      smallint check (trl_max between 1 and 9),
  stages       text[] not null default '{}',       -- etapy innowacji nietechnologicznych, które partnera interesują
  teryt        text references municipalities,
  website      text,
  active       boolean not null default true,
  synthetic    boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint partners_trl_range check (trl_min is null or trl_max is null or trl_min <= trl_max)
);
create index partners_sectors on partners using gin (sectors);
create index partners_domains on partners using gin (domains);

-- Partnerzy we wspólnym indeksie kart (dopasowanie po lematach, 0002_search.sql).
alter table search_index drop constraint search_index_kind_check;
alter table search_index add constraint search_index_kind_check
  check (kind in ('initiative', 'pattern', 'challenge', 'mentor', 'program', 'domain', 'material', 'partner'));

-- ── RLS ─────────────────────────────────────────────────────
alter table institutions        enable row level security;
alter table creators            enable row level security;
alter table initiative_creators enable row level security;
alter table partners            enable row level security;

create policy "publiczny odczyt" on institutions for select using (true);
create policy "publiczny odczyt aktywnych" on partners for select using (active or is_admin());
-- Twórcy tylko dla admina i samego twórcy; publicznie przez widok public_initiative_creators.
create policy "twórca lub admin" on creators for select using (profile_id = auth.uid() or is_admin());
create policy "admin" on initiative_creators for select using (is_admin());

-- ── Widoki publiczne ────────────────────────────────────────
-- Jak w 0004: bez danych kontaktowych, surowego tekstu i pól roboczych karty; filtruje „published” sam.
create view public_initiatives as
select i.id, i.slug, i.status_code, i.title, i.summary, i.domains, i.institution_type, i.stage, i.cross_topics,
       i.innovation_kind, i.sectors, i.trl, i.ip_status,
       i.institution_id, inst.name as institution_name, inst.slug as institution_slug,
       i.teryt, left(i.teryt, 4) as county_teryt, m.name as municipality, m.county,
       i.card - array['clarity', 'followUps', 'alreadyTried'] as card,
       i.radar, coalesce(i.signal_override, i.signal) as signal, i.status,
       i.nominations_count, i.adoptions_count, i.avg_rating, i.synthetic, i.created_at, i.updated_at
from initiatives i
left join municipalities m on m.teryt = i.teryt
left join institutions inst on inst.id = i.institution_id
where i.published and i.duplicate_of is null and i.status <> 'archived';

grant select on public_initiatives to anon, authenticated;

-- Twórcy opublikowanych inicjatyw, którzy zgodzili się na pokazanie (osoba niepełnoletnia: także opiekun).
-- Bez podpisu pokazujemy samą rolę („Uczeń”), więc zespół widać, nawet gdy nikt nie chce być wymieniony z nazwy.
create view public_initiative_creators as
select ic.initiative_id, ic.sort, c.role,
       case when c.show_publicly and (not c.under_18 or c.guardian_consent) then c.display_name end as display_name
from initiative_creators ic
join creators c on c.id = ic.creator_id
join initiatives i on i.id = ic.initiative_id
where i.published and i.duplicate_of is null and i.status <> 'archived';

grant select on public_initiative_creators to anon, authenticated;

-- ── Webhooki: partnerzy filtrują po typie innowacji i sektorze ──
create or replace function initiatives_webhook() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notify_webhooks('initiative.created', jsonb_build_object(
      'id', new.id, 'createdAt', new.created_at, 'submissionKind', new.submission_kind,
      'domains', to_jsonb(new.domains), 'institutionType', new.institution_type, 'stage', new.stage,
      'innovationKind', new.innovation_kind, 'sectors', to_jsonb(new.sectors), 'trl', new.trl,
      'countyTeryt', left(new.teryt, 4), 'synthetic', new.synthetic));
  elsif new.status = 'featured' and old.status is distinct from 'featured' then
    perform notify_webhooks('initiative.featured', jsonb_build_object(
      'id', new.id, 'title', new.title, 'domains', to_jsonb(new.domains), 'institutionType', new.institution_type,
      'stage', new.stage, 'innovationKind', new.innovation_kind, 'sectors', to_jsonb(new.sectors), 'trl', new.trl,
      'countyTeryt', left(new.teryt, 4), 'signal', coalesce(new.signal_override, new.signal),
      'synthetic', new.synthetic));
  end if;
  return null;
end $$;
revoke execute on function initiatives_webhook() from public, anon, authenticated;
