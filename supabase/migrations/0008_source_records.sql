-- Automatyczne wykrywanie (Radar 7/10): rekordy z publicznych źródeł (patenty, publikacje, projekty) i inicjatywy
-- wykryte z nich przez klasyfikator. Wykryta inicjatywa jest prywatna, dopóki twórca jej nie przejmie
-- („Przejmij zgłoszenie”) albo zespół jej nie zweryfikuje. Importery i migawki: data/sources/.

-- ── Rekordy źródłowe ────────────────────────────────────────
-- Bez danych osobowych: importer usuwa nazwiska wynalazców i autorów, zostaje instytucja.
create table source_records (
  id               uuid primary key default gen_random_uuid(),
  source           text not null check (source in ('uprp', 'epo', 'pbn', 'ncbr', 'interreg')),
  external_id      text not null,                   -- numer zgłoszenia, DOI, numer projektu…
  kind             text not null check (kind in ('zgloszenie_patentowe', 'patent', 'publikacja', 'projekt')),
  title            text not null,
  abstract         text,
  institution      text,                            -- instytucja publiczna (wnioskodawca, afiliacja, beneficjent)
  institution_type text,                            -- klucz institutionTypes, jeśli da się ustalić
  teryt            text references municipalities,
  published_on     date,
  url              text,
  license          text not null,                   -- warunki ponownego wykorzystania danych ze źródła
  keywords         text[] not null default '{}',
  classification   jsonb,                           -- SourceClassification (lib/schemas.ts) albo null = nie oceniony
  classified_at    timestamptz,
  synthetic        boolean not null default false,  -- migawka przykładowa, gdy źródło nie ma otwartego API
  fetched_at       timestamptz not null default now(),
  unique (source, external_id)
);
create index source_records_unclassified on source_records (fetched_at) where classification is null;

alter table source_records enable row level security;
-- Metadane publicznych rejestrów, bez danych osób: czytać może każdy (link „podobne rozwiązanie już istnieje”).
create policy "publiczny odczyt" on source_records for select using (true);

-- ── Wykryte inicjatywy ──────────────────────────────────────
alter table initiatives drop constraint initiatives_submission_kind_check;
alter table initiatives add constraint initiatives_submission_kind_check
  check (submission_kind in ('own', 'nomination', 'detected'));

alter table initiatives drop constraint initiatives_status_check;
alter table initiatives add constraint initiatives_status_check
  check (status in ('detected', 'submitted', 'in_review', 'featured', 'supported', 'scaling', 'archived'));

alter table initiatives add column source_record_id uuid references source_records on delete set null;
create unique index initiatives_source_record on initiatives (source_record_id) where source_record_id is not null;

-- Rekordy źródłowe we wspólnym indeksie kart — sprawdzanie dublowania po lematach (0002_search.sql).
alter table search_index drop constraint search_index_kind_check;
alter table search_index add constraint search_index_kind_check
  check (kind in ('initiative', 'pattern', 'challenge', 'mentor', 'program', 'domain', 'material', 'partner', 'source_record'));

-- ── Widoki publiczne: wykryta nigdy, nawet gdyby ktoś ustawił published ──
create or replace view public_initiatives as
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
where i.published and i.duplicate_of is null and i.status not in ('archived', 'detected');

create or replace view public_initiative_creators as
select ic.initiative_id, ic.sort, c.role,
       case when c.show_publicly and (not c.under_18 or c.guardian_consent) then c.display_name end as display_name
from initiative_creators ic
join creators c on c.id = ic.creator_id
join initiatives i on i.id = ic.initiative_id
where i.published and i.duplicate_of is null and i.status not in ('archived', 'detected');

-- ── Webhooki: wykryta nie jest jeszcze zgłoszeniem ──
-- initiative.created idzie dopiero po przejęciu (detected → submitted), z submissionKind = detected.
create or replace function initiatives_webhook() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.status <> 'detected')
     or (tg_op = 'UPDATE' and old.status = 'detected' and new.status <> 'detected') then
    perform notify_webhooks('initiative.created', jsonb_build_object(
      'id', new.id, 'createdAt', new.created_at, 'submissionKind', new.submission_kind,
      'domains', to_jsonb(new.domains), 'institutionType', new.institution_type, 'stage', new.stage,
      'innovationKind', new.innovation_kind, 'sectors', to_jsonb(new.sectors), 'trl', new.trl,
      'countyTeryt', left(new.teryt, 4), 'synthetic', new.synthetic));
  elsif tg_op = 'UPDATE' and new.status = 'featured' and old.status is distinct from 'featured' then
    perform notify_webhooks('initiative.featured', jsonb_build_object(
      'id', new.id, 'title', new.title, 'domains', to_jsonb(new.domains), 'institutionType', new.institution_type,
      'stage', new.stage, 'innovationKind', new.innovation_kind, 'sectors', to_jsonb(new.sectors), 'trl', new.trl,
      'countyTeryt', left(new.teryt, 4), 'signal', coalesce(new.signal_override, new.signal),
      'synthetic', new.synthetic));
  end if;
  return null;
end $$;
revoke execute on function initiatives_webhook() from public, anon, authenticated;

-- ── Trendy w Panelu: kandydaci z importu nie są zgłoszeniami (inaczej jeden import robi „skok”) ──
create or replace function initiative_trends(p_bucket text default 'week')
returns table (bucket date, domain text, initiatives int)
language sql stable as $$
  select date_trunc(p_bucket, i.created_at)::date, d.domain, count(*)::int
  from initiatives i, unnest(i.domains) as d(domain)
  where p_bucket in ('week', 'month') and i.duplicate_of is null and i.status <> 'detected'
  group by 1, 2
  order by 1, 2;
$$;

create or replace function initiatives_by_county()
returns table (county_teryt text, county text, initiatives int, published int, avg_signal numeric)
language sql stable as $$
  select left(i.teryt, 4), min(m.county), count(*)::int, count(*) filter (where i.published)::int,
         round(avg(coalesce(i.signal_override, i.signal)), 0)
  from initiatives i join municipalities m on m.teryt = i.teryt
  where i.duplicate_of is null and i.status <> 'detected'
  group by 1
  order by 3 desc;
$$;

create or replace function rising_keywords(p_days int default 30, p_limit int default 15)
returns table (keyword text, recent int, previous int)
language sql stable as $$
  with k as (
    select lower(kw) as keyword, i.created_at
    from initiatives i, jsonb_array_elements_text(i.card -> 'keywords') as kw
    where i.created_at >= now() - make_interval(days => p_days * 2) and i.status <> 'detected'
    union all
    select lower(kw), c.created_at
    from challenges c, jsonb_array_elements_text(c.card -> 'keywords') as kw
    where c.created_at >= now() - make_interval(days => p_days * 2)
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

revoke execute on function initiative_trends(text), initiatives_by_county(), rising_keywords(int, int)
from public, anon, authenticated;
