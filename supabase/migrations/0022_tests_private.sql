-- Próba (#19): wiersze testów nie są już publiczne. Mają tester_org (nazwa organizacji, bez anonimizacji),
-- tester_id i opinie — razem z innowacją i gminą wskazują konkretną instytucję.
-- Publiczna Biblioteka czyta tylko zagregowane liczniki z innovations (tests_count, rating — trigger z 0004,
-- security definer), a Panel i API czytają tests kluczem service_role. Odczyt przez API: tester własnych wierszy i admin.
drop policy if exists "publiczny odczyt" on tests;
drop policy if exists "tester lub admin" on tests;
create policy "tester lub admin" on tests for select using (tester_id = auth.uid() or is_admin());

-- Tester bez konta może podać e-mail: napiszemy, gdy ROPS zmieni status testu (jak needs/ideas.contact_email z 0018).
alter table tests add column if not exists contact_email text;
