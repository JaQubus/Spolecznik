-- Potrzeby i pomysły dzielą jedną przestrzeń kodów SPL-…: /status, prywatny link i ciasteczko „moich zgłoszeń”
-- szukają po samym kodzie. Kod zajęty w drugiej tabeli zgłaszamy jak naruszenie unikalności (23505),
-- więc pętle ponawiania w lib/match.ts i app/api/ideas/route.ts losują nowy.
create or replace function status_code_free() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_table_name = 'needs' and exists (select 1 from ideas where status_code = new.status_code))
     or (tg_table_name = 'ideas' and exists (select 1 from needs where status_code = new.status_code)) then
    raise exception 'Kod % jest już zajęty', new.status_code using errcode = 'unique_violation';
  end if;
  return new;
end $$;

create trigger needs_status_code_free before insert or update of status_code on needs
  for each row execute function status_code_free();
create trigger ideas_status_code_free before insert or update of status_code on ideas
  for each row execute function status_code_free();
