-- Materiały edukacyjne do sekcji „Ucz się” w Bibliotece i wiedzy.
-- Opisy są nasze, prostym językiem; treść publikacji zostaje u ROPS (tylko odnośniki).
-- Nowy materiał = nowy wiersz (dziś w edytorze tabel Supabase, później w Panelu).

create table materials (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  description text not null,                 -- 2–3 zdania prostym językiem
  audience    text not null,                 -- „Dla samorządów i organizacji”
  kind        text not null check (kind in ('pdf', 'strona')),
  url         text not null,
  publisher   text not null default 'ROPS w Krakowie',
  year        int,
  areas       text[] not null default '{}',  -- obszary Mapy Wyzwań (lib/schemas.ts MWS_AREAS)
  sort        int not null default 100,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table materials enable row level security;
create policy "publiczny odczyt" on materials for select using (active);

insert into materials (slug, title, description, audience, kind, url, publisher, year, areas, sort) values
('przewodnik-innmalopolska',
 'Przewodnik po innowacjach społecznych',
 'Jak urząd może pomagać ludziom, którzy mają pomysł na rozwiązanie problemu w swojej okolicy? Przewodnik opisuje, czego nauczył się Małopolski Inkubator Innowacji Społecznych: od naboru pomysłów po ich testowanie.',
 'Dla samorządów, organizacji i autorów pomysłów', 'pdf',
 'https://rops.krakow.pl/mpliki/IS/ikony_PUBLIKACJE/InnMalopolska_przewodnik_po_innowacjach.pdf',
 'ROPS w Krakowie', 2019, '{}', 10),
('innowacje-dla-dostepnosci',
 'Innowacje społeczne dla dostępności',
 'Zbiór rozwiązań, które ułatwiają codzienne życie i usuwają bariery. Każde z nich przetestowano w praktyce w projekcie Inkubator Dostępności. Dobry początek, jeśli szukasz pomysłów na dostępną gminę.',
 'Dla wszystkich, którzy działają na rzecz dostępności', 'pdf',
 'https://rops.krakow.pl/mpliki/IS/ikony_PUBLIKACJE/Innowacje_spoleczne_dla_dostepnosci.pdf',
 'ROPS w Krakowie', 2022, '{niepelnosprawnosc,seniorzy}', 20),
('polacz-kropki',
 'Połącz kropki, czyli o sile innowacji społecznych w obszarze włączenia społecznego',
 'Poznasz rozwiązania, które powstały w projekcie Inkubator Włączenia Społecznego. Pomagają osobom, którym grozi wykluczenie, wrócić do życia społeczności.',
 'Dla organizacji, ośrodków pomocy społecznej i samorządów', 'pdf',
 'https://rops.krakow.pl/mpliki/IS/PUBLIKACJE_INKUBATOROW/Pocz_kropki_Publikacja_IWS.pdf',
 'ROPS w Krakowie', 2023, '{ubostwo,bezdomnosc}', 30),
('social-canvas-inno-agh',
 'Social Canvas INNO AGH',
 'Plansza, na której krok po kroku opiszesz swój pomysł: jaki problem rozwiązuje, dla kogo jest i czego potrzebuje. Przydaje się na warsztacie w grupie albo przed pisaniem wniosku.',
 'Dla autorów pomysłów i zespołów', 'pdf',
 'https://rops.krakow.pl/mpliki/IS/Moj_folder/INNO_AGH_-_SOCIAL_CANVAS.pdf',
 'INNO AGH i ROPS w Krakowie', null, '{}', 40),
('mapa-wyzwan-spolecznych',
 'Mapa Wyzwań Społecznych',
 'Osiem obszarów, w których najbardziej brakuje dobrych rozwiązań, m.in. seniorzy, zdrowie psychiczne i bezdomność. Każdy obszar ma krótki opis i listę konkretnych wyzwań.',
 'Dla wszystkich', 'pdf',
 'https://rops.krakow.pl/mpliki/IS/IWS_20/za._nr_2._Mapa_Wyzwa_Spoecznych.pdf',
 'ROPS w Krakowie', null, '{}', 50),
('raporty-z-badan',
 'Raporty z badań ROPS',
 'Badania i analizy o pomocy społecznej w Małopolsce, na przykład ocena zasobów pomocy społecznej. Przydadzą się, gdy chcesz poprzeć wniosek albo decyzję liczbami.',
 'Dla samorządów, ośrodków pomocy społecznej i badaczy', 'strona',
 'https://rops.krakow.pl/badania-analizy-raporty/raporty-z-badan',
 'ROPS w Krakowie', null, '{}', 60),
('obserwator-statystyk',
 'Internetowy Obserwator Statystyk Społecznych',
 'Liczby o gminach i powiatach Małopolski: ludność, pomoc społeczna, zdrowie i rynek pracy. Z tego źródła pochodzą dane w części „Kondycja Małopolski”.',
 'Dla samorządów i wszystkich, którzy szukają danych', 'strona',
 'https://obserwator.rops.krakow.pl/',
 'ROPS w Krakowie', null, '{}', 70),
('publikacje-ze-swiata-innowacji',
 'Publikacje ze świata innowacji',
 'Wszystkie publikacje ROPS o innowacjach społecznych w jednym miejscu, także po angielsku. Tu znajdziesz nowe materiały, zanim trafią do tej listy.',
 'Dla wszystkich', 'strona',
 'https://rops.krakow.pl/innowacje-spoleczne/publikacje-ze-swiata-innowacji',
 'ROPS w Krakowie', null, '{}', 80)
on conflict (slug) do nothing;
