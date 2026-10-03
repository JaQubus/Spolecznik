-- „Przetestowano w N gminach, średnio X” na kartach innowacji ma się zmieniać od razu po
-- zgłoszeniu oceny w Próbie, a nie dopiero po ponownym uruchomieniu pipeline'u.
-- Jedna definicja liczników: używa jej trigger poniżej i data/embed.py.

create or replace function refresh_innovation_test_stats(p_innovation_id uuid)
returns void
language sql
security definer            -- tester nie ma prawa zapisu do innovations (RLS)
set search_path = public
as $$
  update innovations i set
    tests_count = s.n,
    avg_rating  = s.avg
  from (
    select count(*) filter (where t.rating is not null) as n,
           round(avg(t.rating), 1)                        as avg
    from tests t
    where t.innovation_id = p_innovation_id
  ) s
  where i.id = p_innovation_id;
$$;

revoke execute on function refresh_innovation_test_stats(uuid) from public, anon, authenticated;

create or replace function tests_refresh_innovation_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform refresh_innovation_test_stats(old.innovation_id);
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.innovation_id is distinct from old.innovation_id) then
    perform refresh_innovation_test_stats(new.innovation_id);
  end if;
  return null;
end;
$$;

create trigger tests_refresh_innovation_stats
after insert or update of innovation_id, rating or delete on tests
for each row execute function tests_refresh_innovation_stats();

-- Wyrównanie istniejących danych.
select refresh_innovation_test_stats(id) from innovations;
