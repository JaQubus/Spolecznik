-- Logowanie magic linkiem (#24): pierwszy login zakłada profil z domyślną rolą 'mieszkaniec'.
-- Rolę admina/eksperta nadaje się ręcznie: update profiles set role = 'admin' where id = '<uuid>';
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Próba (#19): „Chcę przetestować” — kto i kiedy.
alter table tests
  add column if not exists tester_org text,
  add column if not exists planned_for date;
