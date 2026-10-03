-- Społecznik·Panel (README §6): konta, przypisanie eksperta, historia zgłoszenia.
-- Profil dla nowego konta zakłada trigger handle_new_user z 0006_profiles_and_tests.

-- Konta założone przed tamtą migracją.
insert into profiles (id) select id from auth.users on conflict (id) do nothing;

-- handle_new_user odpala wyłącznie trigger; jako security definer nie powinien być wywoływalny wprost.
revoke execute on function handle_new_user() from public, anon, authenticated;

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

-- Pozostałości wersji z embeddingami (wcześniejsze 0005_doc_search i 0006_panel) — zastąpione przez 0005_keyword_search.
drop function if exists need_triage(uuid[], float, float);
drop function if exists need_neighbours(uuid, text, int);
drop function if exists match_doc_chunks(vector, int);
