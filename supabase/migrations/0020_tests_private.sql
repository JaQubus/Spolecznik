-- Próba (#19): wiersze testów nie są już publiczne. Mają tester_org (nazwa organizacji, bez anonimizacji),
-- tester_id i opinie — razem z innowacją i gminą wskazują konkretną instytucję.
-- Publiczna Biblioteka czyta tylko zagregowane liczniki z innovations (tests_count, rating — trigger z 0004,
-- security definer), a Panel i API czytają tests kluczem service_role. Odczyt przez API: tester własnych wierszy i admin.
drop policy if exists "publiczny odczyt" on tests;
create policy "tester lub admin" on tests for select using (tester_id = auth.uid() or is_admin());
