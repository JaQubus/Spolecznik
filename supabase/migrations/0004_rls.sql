-- RLS na każdej tabeli. Zapisy z aplikacji idą przez service_role (route handlers po walidacji),
-- więc poniżej głównie odczyty klienta. Tabela bez polityki = dostęp tylko dla service_role.

alter table profiles            enable row level security;
alter table municipalities      enable row level security;
alter table patterns            enable row level security;
alter table mentors             enable row level security;
alter table programs            enable row level security;
alter table initiatives         enable row level security;
alter table challenges          enable row level security;
alter table matches             enable row level security;
alter table applications        enable row level security;
alter table adoptions           enable row level security;
alter table transfer_plans      enable row level security;
alter table audit_log           enable row level security;
alter table domains             enable row level security;
alter table facts               enable row level security;
alter table materials           enable row level security;
alter table cluster_labels      enable row level security;
alter table search_index        enable row level security;
alter table threads             enable row level security;
alter table thread_participants enable row level security;
alter table messages            enable row level security;
alter table notifications       enable row level security;
alter table webhook_endpoints   enable row level security;

-- ── Profile: własny, bez samodzielnej zmiany roli ───────────
create policy "własny profil" on profiles for select using (id = auth.uid() or is_admin());
create policy "edycja własnego profilu" on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from profiles p where p.id = auth.uid()));

-- ── Publiczne dane referencyjne ─────────────────────────────
create policy "publiczny odczyt" on municipalities for select using (true);
create policy "publiczny odczyt" on programs       for select using (true);
create policy "publiczny odczyt aktywnych" on mentors for select using (active or is_admin());
create policy "publiczny odczyt opublikowanych" on patterns  for select using (published or is_admin());
create policy "publiczny odczyt opublikowanych" on domains   for select using (published or is_admin());
create policy "publiczny odczyt opublikowanych" on facts     for select using (published or is_admin());
create policy "publiczny odczyt opublikowanych" on materials for select using (published or is_admin());

-- ── Inicjatywy: tabela tylko dla autora i admina, publicznie widok ──
create policy "autor lub admin" on initiatives for select using (author_id = auth.uid() or is_admin());

-- Opublikowane inicjatywy bez danych kontaktowych, surowego tekstu i pól roboczych karty.
-- Strony publiczne i API v1 czytają ten widok, nigdy tabelę. Widok działa z prawami właściciela,
-- więc omija RLS tabeli — dlatego sam filtruje „published”.
create view public_initiatives as
select i.id, i.slug, i.status_code, i.title, i.summary, i.domains, i.institution_type, i.stage, i.cross_topics, i.ris,
       i.teryt, left(i.teryt, 4) as county_teryt, m.name as municipality, m.county,
       i.card - array['clarity', 'followUps', 'alreadyTried'] as card,
       i.radar, coalesce(i.signal_override, i.signal) as signal, i.status,
       i.nominations_count, i.adoptions_count, i.avg_rating, i.synthetic, i.created_at, i.updated_at
from initiatives i
left join municipalities m on m.teryt = i.teryt
where i.published and i.duplicate_of is null and i.status <> 'archived';

grant select on public_initiatives to anon, authenticated;

-- ── Prywatne: tylko admin (reszta przez serwer) ─────────────
create policy "admin" on challenges     for select using (is_admin());
create policy "admin" on matches        for select using (is_admin());
create policy "admin" on applications   for select using (is_admin());
create policy "admin" on audit_log      for select using (is_admin());
create policy "admin" on cluster_labels for select using (is_admin());
create policy "admin" on webhook_endpoints for all using (is_admin()) with check (is_admin());

-- Adopcja wskazuje konkretną instytucję (adopter_org, gmina, opinie), plan przeniesienia też.
create policy "autor lub admin" on adoptions      for select using (tester_id = auth.uid() or is_admin());
create policy "autor lub admin" on transfer_plans for select using (author_id = auth.uid() or is_admin());

-- ── Rozmowy: tylko uczestnicy, którzy przyjęli zaproszenie; admin jako moderator ──
create policy "uczestnik wątku" on threads for select using (
  is_admin() or exists (select 1 from thread_participants p
    where p.thread_id = threads.id and p.user_id = auth.uid() and p.status = 'przyjete'));
create policy "odczyt: uczestnik wątku" on messages for select using (
  is_admin() or exists (select 1 from thread_participants p
    where p.thread_id = messages.thread_id and p.user_id = auth.uid() and p.status = 'przyjete'));
create policy "pisanie: uczestnik wątku" on messages for insert with check (
  author_id = auth.uid() and exists (select 1 from thread_participants p
    where p.thread_id = messages.thread_id and p.user_id = auth.uid() and p.status = 'przyjete'));
create policy "własne" on thread_participants for select using (user_id = auth.uid() or is_admin());

create policy "własne powiadomienia" on notifications for select using (
  user_id = auth.uid() or (role = 'admin' and is_admin()));
