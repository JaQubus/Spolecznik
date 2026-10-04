-- „Zapytaj ROPS”: asystent AI jako pierwsza linia w rozmowie (#20).
-- Odpowiedź asystenta zawsze ze źródłami: [{kind: 'raport'|'innowacja', title, href, page, year}].
alter table messages add column if not exists sources jsonb;

-- Czy rozmowa czeka na człowieka: asystent przekazał pytanie albo autor kliknął „To nie odpowiada na moje pytanie”
-- (priority). Odpowiedź ROPS albo eksperta zeruje oba pola.
alter table threads add column if not exists awaiting_human boolean not null default false;
alter table threads add column if not exists priority boolean not null default false;
create index if not exists threads_awaiting on threads (entity_kind) where awaiting_human;
