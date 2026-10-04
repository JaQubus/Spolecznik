-- Partnerstwa (README §6, #20): wątek grupowy gmin z podobnym problemem.
-- Wątek entity_kind = 'partnerstwo', entity_id = zgłoszenie gminy, która zaprasza (jedno partnerstwo na zgłoszenie).
-- Uczestnicy to zgłoszenia (autorzy piszą bez konta, po kluczu z lib/need-access.ts), więc thread_participants
-- dostaje need_id obok user_id. Zaproszeni widzą wątek dopiero po zgodzie (RODO, README §10).
-- Admin ROPS jest w każdym wątku jako moderator (is_admin() w politykach z 0001), bez osobnego wiersza.

alter table threads drop constraint if exists threads_entity_kind;
alter table threads add constraint threads_entity_kind
  check (entity_kind in ('potrzeba','pomysl','innowacja','partnerstwo'));

alter table thread_participants drop constraint if exists thread_participants_pkey;
alter table thread_participants add column if not exists id uuid not null default gen_random_uuid() primary key;
alter table thread_participants alter column user_id drop not null;
alter table thread_participants alter column thread_id set not null;
alter table thread_participants add column if not exists need_id uuid references needs on delete cascade;
alter table thread_participants add column if not exists status text not null default 'przyjete'
  check (status in ('zaproszone','przyjete','odrzucone'));
alter table thread_participants add column if not exists responded_at timestamptz;
alter table thread_participants add column if not exists created_at timestamptz not null default now();
alter table thread_participants add constraint thread_participants_who check (user_id is not null or need_id is not null);
create unique index if not exists thread_participants_user on thread_participants (thread_id, user_id) where user_id is not null;
create unique index if not exists thread_participants_need on thread_participants (thread_id, need_id) where need_id is not null;
create index if not exists thread_participants_by_need on thread_participants (need_id) where need_id is not null;

-- Wiadomość w partnerstwie podpisuje gmina; zgłoszenie autora pozwala oznaczyć „Ty” bez wysyłania id do przeglądarki.
alter table messages add column if not exists author_need uuid references needs on delete set null;

-- Zaproszony, który nie przyjął zaproszenia, nie czyta wątku (dotyczy kont; autorzy bez konta i tak idą przez serwer).
-- threads.id wprost: thread_participants ma teraz własne id, więc gołe „id” w podzapytaniu wskazałoby uczestnika.
drop policy if exists "uczestnik wątku" on threads;
create policy "uczestnik wątku" on threads for select using (
  is_admin() or exists (select 1 from thread_participants p
    where p.thread_id = threads.id and p.user_id = auth.uid() and p.status = 'przyjete'));
drop policy if exists "odczyt: uczestnik wątku" on messages;
create policy "odczyt: uczestnik wątku" on messages for select using (
  is_admin() or exists (select 1 from thread_participants p
    where p.thread_id = messages.thread_id and p.user_id = auth.uid() and p.status = 'przyjete'));
drop policy if exists "pisanie: uczestnik wątku" on messages;
create policy "pisanie: uczestnik wątku" on messages for insert with check (
  author_id = auth.uid() and exists (select 1 from thread_participants p
    where p.thread_id = messages.thread_id and p.user_id = auth.uid() and p.status = 'przyjete'));
