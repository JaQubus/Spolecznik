-- Liczniki adopcji, trendy i mapa białych plam dla Panelu.
-- Funkcje analityczne wywołuje serwer kluczem service_role po sprawdzeniu roli admina — dla klientów są zablokowane.

-- ── „Wypróbowano w N miejscach, średnio X” ─────────────────
-- Jedna definicja liczników dla inicjatyw i rozwiązań: trigger poniżej i data/load.py.
create or replace function refresh_adoption_stats(p_initiative_id uuid, p_pattern_id uuid) returns void
language sql security definer set search_path = public as $$
  update initiatives i set adoptions_count = s.n, avg_rating = s.avg
  from (select count(*) filter (where a.status = 'zakonczony') as n, round(avg(a.rating), 1) as avg
        from adoptions a where a.initiative_id = p_initiative_id) s
  where p_initiative_id is not null and i.id = p_initiative_id;
  update patterns p set adoptions_count = s.n, avg_rating = s.avg
  from (select count(*) filter (where a.status = 'zakonczony') as n, round(avg(a.rating), 1) as avg
        from adoptions a where a.pattern_id = p_pattern_id) s
  where p_pattern_id is not null and p.id = p_pattern_id;
$$;

create or replace function adoptions_refresh_stats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform refresh_adoption_stats(old.initiative_id, old.pattern_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform refresh_adoption_stats(new.initiative_id, new.pattern_id);
  end if;
  return null;
end $$;

create trigger adoptions_refresh_stats
after insert or update of initiative_id, pattern_id, status, rating or delete on adoptions
for each row execute function adoptions_refresh_stats();

-- ── Trendy ──────────────────────────────────────────────────
-- Nowe inicjatywy w czasie, po dziedzinach.
create or replace function initiative_trends(p_bucket text default 'week')
returns table (bucket date, domain text, initiatives int)
language sql stable as $$
  select date_trunc(p_bucket, i.created_at)::date, d.domain, count(*)::int
  from initiatives i, unnest(i.domains) as d(domain)
  where p_bucket in ('week', 'month') and i.duplicate_of is null
  group by 1, 2
  order by 1, 2;
$$;

-- Inicjatywy po powiatach (wszystkie i opublikowane) — do mapy w Panelu.
create or replace function initiatives_by_county()
returns table (county_teryt text, county text, initiatives int, published int, avg_signal numeric)
language sql stable as $$
  select left(i.teryt, 4), min(m.county), count(*)::int, count(*) filter (where i.published)::int,
         round(avg(coalesce(i.signal_override, i.signal)), 0)
  from initiatives i join municipalities m on m.teryt = i.teryt
  where i.duplicate_of is null
  group by 1
  order by 3 desc;
$$;

-- Słowa kluczowe z kart inicjatyw i wyzwań: ostatnie p_days dni vs poprzednie p_days.
create or replace function rising_keywords(p_days int default 30, p_limit int default 15)
returns table (keyword text, recent int, previous int)
language sql stable as $$
  with k as (
    select lower(kw) as keyword, i.created_at
    from initiatives i, jsonb_array_elements_text(i.card -> 'keywords') as kw
    where i.created_at >= now() - make_interval(days => p_days * 2)
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

-- ── Białe plamy: powiat × dziedzina ─────────────────────────
-- Ile opublikowanych inicjatyw ma każda dziedzina w każdym powiecie, ile jest zapotrzebowania bez rozwiązania
-- (wyzwania z luką) i ilu ludzi tam mieszka. Biała plama = 0 inicjatyw przy dużej liczbie mieszkańców
-- albo przy zgłoszonym zapotrzebowaniu.
create or replace function white_spots()
returns table (county_teryt text, county text, domain text, initiatives int, gaps int, population int)
language sql stable as $$
  with counties as (
    select county_teryt, min(county) as county, sum(population)::int as population
    from municipalities group by county_teryt
  ),
  ini as (
    select left(i.teryt, 4) as county_teryt, d.domain, count(*)::int as n
    from initiatives i, unnest(i.domains) as d(domain)
    where i.published and i.duplicate_of is null
    group by 1, 2
  ),
  gap as (
    select left(c.teryt, 4) as county_teryt, d.domain, count(*)::int as n
    from challenges c, jsonb_array_elements_text(c.card -> 'domains') as d(domain)
    where c.is_gap
    group by 1, 2
  )
  select k.county_teryt, k.county, dm.key, coalesce(ini.n, 0), coalesce(gap.n, 0), k.population
  from counties k
  cross join domains dm
  left join ini on ini.county_teryt = k.county_teryt and ini.domain = dm.key
  left join gap on gap.county_teryt = k.county_teryt and gap.domain = dm.key
  order by k.county_teryt, dm.sort;
$$;

revoke execute on function
  refresh_adoption_stats(uuid, uuid), adoptions_refresh_stats(),
  initiative_trends(text), initiatives_by_county(), rising_keywords(int, int), white_spots()
from public, anon, authenticated;
