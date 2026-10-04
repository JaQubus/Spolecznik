-- Webhooki dla systemów Hubu (#67), np. bazy grantowej: baza sama wysyła zdarzenia przez pg_net,
-- bez udziału serwera Next. Kontrakt treści: lib/api/contract.ts (IdeaCreatedEvent, CallChangedEvent), opis: /api-docs.
create extension if not exists pg_net;
create extension if not exists pgcrypto with schema extensions;

create table webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  url         text not null check (url ~ '^https://'),
  events      text[] not null check (
                cardinality(events) > 0 and events <@ array['idea.created','call.activated','call.deactivated']
              ),
  -- Klucz HMAC: odbiorca liczy sha256 z surowej treści i porównuje z nagłówkiem X-Spolecznik-Signature.
  secret      text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Adresy i klucze widzi i zmienia tylko admin (Panel / SQL); wysyła funkcja security definer niżej.
alter table webhook_endpoints enable row level security;
create policy "admin" on webhook_endpoints for all using (is_admin()) with check (is_admin());

-- Wysyła zdarzenie na każdy aktywny adres, który je subskrybuje. pg_net działa asynchronicznie
-- (po zatwierdzeniu transakcji, bez ponowień); odpowiedzi leżą przez 6 h w net._http_response.
create or replace function notify_webhooks(p_event text, p_data jsonb)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
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
        'X-Spolecznik-Event', p_event,
        'X-Spolecznik-Signature', 'sha256=' || encode(hmac(v_body::text, e.secret, 'sha256'), 'hex')
      )
    );
  end loop;
exception when others then
  -- Webhook nie może zablokować zapisu pomysłu ani naboru.
  raise warning 'notify_webhooks(%): %', p_event, sqlerrm;
end $$;

revoke execute on function notify_webhooks(text, jsonb) from public, anon, authenticated;

-- Nowy pomysł: bez treści fiszki (pomysły są prywatne do moderacji), tylko obszary potrzeby, z której wyrósł.
create or replace function ideas_webhook() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  perform notify_webhooks('idea.created', jsonb_build_object(
    'id', new.id,
    'createdAt', new.created_at,
    'status', new.status,
    'needAreas', coalesce((select n.card -> 'areas' from needs n where n.id = new.need_id), '[]'::jsonb),
    'synthetic', new.synthetic
  ));
  return null;
end $$;

create trigger ideas_webhook after insert on ideas
  for each row execute function ideas_webhook();

-- Nabór otwarty albo zamknięty (Panel → Nabory) albo dodany od razu jako otwarty.
create or replace function calls_webhook() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.active is not distinct from new.active then return null; end if;
  if tg_op = 'INSERT' and not new.active then return null; end if;
  perform notify_webhooks(case when new.active then 'call.activated' else 'call.deactivated' end, jsonb_build_object(
    'id', new.id,
    'title', new.title,
    'active', new.active,
    'opensAt', new.opens_at,
    'closesAt', new.closes_at,
    'synthetic', new.synthetic
  ));
  return null;
end $$;

create trigger calls_webhook after insert or update of active on calls
  for each row execute function calls_webhook();
