-- Rozmowy, partnerstwa, powiadomienia i webhooki.

-- ── Rozmowy ─────────────────────────────────────────────────
-- Jeden wątek na inicjatywę (autor ↔ PCI ↔ mentor) albo na partnerstwo (autorzy podobnych inicjatyw + PCI).
-- Autor pisze bez konta, po kodzie i tajnym kluczu — zapisy idą przez route handler (service_role).
create table threads (
  id             uuid primary key default gen_random_uuid(),
  entity_kind    text not null check (entity_kind in ('initiative', 'partnership')),
  entity_id      uuid not null,
  title          text,
  mentor_id      uuid references mentors on delete set null,
  awaiting_human boolean not null default false,  -- asystent przekazał pytanie człowiekowi
  priority       boolean not null default false,  -- autor oznaczył jako pilne
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (entity_kind, entity_id)
);
create index threads_awaiting on threads (entity_kind) where awaiting_human;

-- Uczestnik to konto (user_id) albo inicjatywa, której autor pisze bez konta (initiative_id).
-- Zaproszeni do partnerstwa widzą wątek dopiero po zgodzie (status = 'przyjete').
create table thread_participants (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references threads on delete cascade,
  user_id       uuid references auth.users on delete cascade,
  initiative_id uuid references initiatives on delete cascade,
  status        text not null default 'przyjete' check (status in ('zaproszone', 'przyjete', 'odrzucone')),
  responded_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint thread_participants_who check (user_id is not null or initiative_id is not null)
);
create unique index thread_participants_user on thread_participants (thread_id, user_id) where user_id is not null;
create unique index thread_participants_initiative on thread_participants (thread_id, initiative_id) where initiative_id is not null;
create index thread_participants_by_initiative on thread_participants (initiative_id) where initiative_id is not null;

-- Kto pisze: autor, pracownik organizatora (staff), mentor albo asystent AI (pierwsza linia, zawsze ze źródłami).
create table messages (
  id                uuid primary key default gen_random_uuid(),
  thread_id         uuid not null references threads on delete cascade,
  author_id         uuid references auth.users on delete set null,
  author_role       text not null default 'author' check (author_role in ('author', 'staff', 'mentor', 'ai')),
  author_name       text,
  author_initiative uuid references initiatives on delete set null,  -- podpis w partnerstwie, „Ty” bez wysyłania id
  body              text not null,
  sources           jsonb,                                            -- [{kind, title, href}] przy odpowiedzi AI
  created_at        timestamptz not null default now()
);
create index messages_thread_created on messages (thread_id, created_at);

-- ── Powiadomienia (dzwonek) ─────────────────────────────────
-- Do osoby (user_id) albo do całej roli (role = 'admin'). Stan „widziane” trzyma ciasteczko dzwonka, nie wiersz.
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade,
  role       text,
  kind       text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index notifications_user on notifications (user_id, created_at desc);
create index notifications_role on notifications (role, created_at desc);

alter publication supabase_realtime add table messages, notifications;

-- ── Webhooki dla systemów zewnętrznych ──────────────────────
-- Baza sama wysyła zdarzenia przez pg_net. Kontrakt treści: lib/api/contract.ts, opis: /api-docs.
create extension if not exists pg_net;
create extension if not exists pgcrypto with schema extensions;

create table webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  url         text not null check (url ~ '^https://'),
  events      text[] not null check (
                cardinality(events) > 0
                and events <@ array['initiative.created', 'initiative.featured', 'program.activated', 'program.deactivated']
              ),
  -- Klucz HMAC: odbiorca liczy sha256 z surowej treści i porównuje z nagłówkiem X-Webhook-Signature.
  secret      text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create or replace function notify_webhooks(p_event text, p_data jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  e record;
  -- pg_net wysyła body::text, więc podpisujemy dokładnie ten sam napis.
  v_body jsonb := jsonb_build_object('event', p_event, 'occurredAt', now(), 'data', p_data);
begin
  for e in select url, secret from webhook_endpoints where active and p_event = any(events) loop
    perform net.http_post(
      url     := e.url,
      body    := v_body,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Webhook-Event', p_event,
        'X-Webhook-Signature', 'sha256=' || encode(hmac(v_body::text, e.secret, 'sha256'), 'hex')
      )
    );
  end loop;
exception when others then
  -- Webhook nie może zablokować zapisu inicjatywy ani programu.
  raise warning 'notify_webhooks(%): %', p_event, sqlerrm;
end $$;
revoke execute on function notify_webhooks(text, jsonb) from public, anon, authenticated;

-- Nowa inicjatywa: bez treści (do weryfikacji jest prywatna), tylko klasyfikacja i sygnał.
-- Wyróżniona (status featured): to samo plus tytuł, bo jest już po weryfikacji.
create or replace function initiatives_webhook() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notify_webhooks('initiative.created', jsonb_build_object(
      'id', new.id, 'createdAt', new.created_at, 'submissionKind', new.submission_kind,
      'domains', to_jsonb(new.domains), 'institutionType', new.institution_type, 'stage', new.stage,
      'countyTeryt', left(new.teryt, 4), 'synthetic', new.synthetic));
  elsif new.status = 'featured' and old.status is distinct from 'featured' then
    perform notify_webhooks('initiative.featured', jsonb_build_object(
      'id', new.id, 'title', new.title, 'domains', to_jsonb(new.domains), 'institutionType', new.institution_type,
      'stage', new.stage, 'countyTeryt', left(new.teryt, 4), 'signal', coalesce(new.signal_override, new.signal),
      'synthetic', new.synthetic));
  end if;
  return null;
end $$;

create trigger initiatives_webhook after insert or update of status on initiatives
  for each row execute function initiatives_webhook();

-- Program otwarty albo zamknięty (Panel → Programy) albo dodany od razu jako otwarty.
create or replace function programs_webhook() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.active is not distinct from new.active then return null; end if;
  if tg_op = 'INSERT' and not new.active then return null; end if;
  perform notify_webhooks(case when new.active then 'program.activated' else 'program.deactivated' end, jsonb_build_object(
    'id', new.id, 'title', new.title, 'active', new.active, 'opensAt', new.opens_at, 'closesAt', new.closes_at,
    'synthetic', new.synthetic));
  return null;
end $$;

create trigger programs_webhook after insert or update of active on programs
  for each row execute function programs_webhook();

revoke execute on function initiatives_webhook(), programs_webhook() from public, anon, authenticated;
