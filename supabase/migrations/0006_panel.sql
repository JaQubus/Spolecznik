-- Społecznik·Panel (README §6): konta, przypisanie eksperta, triage liczony na żywo.

-- ── Profil dla każdego nowego konta ─────────────────────────
-- Logowanie magic linkiem zakłada użytkownika w auth.users; bez wiersza w profiles
-- is_admin() i requireAdmin() nie miałyby czego sprawdzić. Rolę admina nadajemy ręcznie:
--   update profiles set role = 'admin' where id = (select id from auth.users where email = '…');
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- Konta założone przed tą migracją.
insert into profiles (id) select id from auth.users on conflict (id) do nothing;

-- Zwykły użytkownik nie może sam nadać sobie roli admina przez „edycję własnego profilu”.
drop policy "edycja własnego profilu" on profiles;
create policy "edycja własnego profilu" on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from profiles p where p.id = auth.uid()));

-- ── Przypisanie eksperta ────────────────────────────────────
-- Eksperci na razie istnieją tylko w search_index (kind = 'ekspert'), stąd brak klucza obcego.
alter table needs add column if not exists assigned_expert uuid;
alter table needs add column if not exists updated_at timestamptz not null default now();

-- Historia zmian jednego zgłoszenia (Panel i oś czasu na /status/[kod]).
create index if not exists audit_log_entity on audit_log (entity, entity_id, created_at);
create index if not exists needs_status_created on needs (status, created_at desc);

-- ── Triage na żywo ──────────────────────────────────────────
-- Duplikaty i sugerowany ekspert dla strony skrzynki, z embeddingów już zapisanych w indeksie.
-- Liczone przy odczycie, więc obejmują też zgłoszenia, które pojawiły się później.
create or replace function need_triage(
  p_need_ids uuid[], p_dup_min float default 0.9, p_expert_min float default 0.35
) returns table (need_id uuid, duplicates uuid[], expert_id uuid, expert_name text, expert_similarity float)
language sql stable as $$
  select n.ref_id, coalesce(d.ids, '{}'), e.ref_id, e.title, e.similarity
  from search_index n
  left join lateral (
    select array_agg(x.ref_id) as ids from (
      select o.ref_id, 1 - (o.embedding <=> n.embedding) as sim
      from search_index o
      where o.kind = 'potrzeba' and o.ref_id <> n.ref_id and o.embedding is not null
      order by o.embedding <=> n.embedding
      limit 5
    ) x where x.sim >= p_dup_min
  ) d on true
  left join lateral (
    select o.ref_id, o.title, (1 - (o.embedding <=> n.embedding))::float as similarity
    from search_index o
    where o.kind = 'ekspert' and o.active and o.embedding is not null
    order by o.embedding <=> n.embedding
    limit 1
  ) e on e.similarity >= p_expert_min
  where n.kind = 'potrzeba' and n.ref_id = any(p_need_ids) and n.embedding is not null;
$$;

-- Najbliższe karty danego rodzaju dla jednego zgłoszenia (szczegóły w Panelu).
create or replace function need_neighbours(
  p_need_id uuid, p_kind text, p_count int default 5
) returns table (ref_id uuid, title text, body text, teryt text, similarity float)
language sql stable as $$
  select o.ref_id, o.title, o.body, o.teryt, (1 - (o.embedding <=> n.embedding))::float
  from search_index n
  join search_index o on o.kind = p_kind and o.active and o.embedding is not null and o.ref_id <> n.ref_id
  where n.kind = 'potrzeba' and n.ref_id = p_need_id and n.embedding is not null
  order by o.embedding <=> n.embedding
  limit p_count;
$$;

-- Wywołuje tylko serwer (service_role) po sprawdzeniu roli admina.
-- handle_new_user odpala wyłącznie trigger (security definer, więc zabieramy też jawne EXECUTE).
revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function need_triage(uuid[], float, float) from public, anon, authenticated;
revoke execute on function need_neighbours(uuid, text, int) from public, anon, authenticated;
