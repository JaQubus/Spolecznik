-- Panel usuwa zgłoszenia, pomysły i nabory. Bez tych zmian blokują to klucze obce:
-- pomysł z luki zostaje (traci tylko powiązanie z usuniętą potrzebą), szkice wniosków do usuniętego naboru znikają.
-- Wątki, indeks wyszukiwarki i powiadomienia są powiązane bez kluczy obcych — sprząta je akcja w Panelu.
alter table ideas drop constraint if exists ideas_need_id_fkey;
alter table ideas add constraint ideas_need_id_fkey foreign key (need_id) references needs on delete set null;

alter table applications drop constraint if exists applications_call_id_fkey;
alter table applications add constraint applications_call_id_fkey foreign key (call_id) references calls on delete cascade;
