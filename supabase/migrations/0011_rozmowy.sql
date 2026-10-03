-- Społecznik·Rozmowy (README §6): jeden wątek przypięty do karty.
-- Autor zgłoszenia pisze po kodzie SPL-…, bez konta — zapisy idą przez route handler (service_role).
-- Eksperci istnieją na razie tylko w search_index (kind = 'ekspert'), stąd expert_id bez klucza obcego.

alter table threads add column if not exists expert_id  uuid;
alter table threads add column if not exists updated_at timestamptz not null default now();
alter table threads add constraint threads_entity_kind check (entity_kind in ('potrzeba','pomysl','innowacja'));
create unique index if not exists threads_entity on threads (entity_kind, entity_id);

-- Kto pisze: autor karty, pracownik ROPS, ekspert albo AI (pierwsza linia „Zapytaj ROPS”).
-- author_name to podpis widoczny w wątku; author_id tylko dla zalogowanych.
alter table messages add column if not exists author_role text not null default 'autor'
  check (author_role in ('autor','rops','ekspert','ai'));
alter table messages add column if not exists author_name text;
create index if not exists messages_thread_created on messages (thread_id, created_at);
