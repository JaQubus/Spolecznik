-- Kondycja Małopolski: wskaźniki 22 powiatów z Internetowego Obserwatora Statystyk Społecznych
-- (dane/powiaty/wszystkie_powiaty.csv). Ładuje data/import_powiaty.py; kolejny rok to kolejne wiersze.

create table powiaty_wskazniki (
  powiat     text not null,          -- identyfikator: bochenski, krakow (miasto), krakowski…
  nazwa      text not null,          -- jak w źródle: „powiat bocheński”, „powiat m. Kraków”
  kategoria  text not null,          -- pełna nazwa grupy (data/powiaty_mapping.json)
  wskaznik   text not null,
  opis       text,
  rok        int  not null,
  wartosc    numeric,
  jednostka  text not null default '',
  primary key (powiat, wskaznik, rok)
);
create index on powiaty_wskazniki (wskaznik, rok);

-- Odczyt publiczny; zapis tylko service_role (omija RLS), czyli skrypt importu i przyszły Panel.
alter table powiaty_wskazniki enable row level security;
create policy "publiczny odczyt" on powiaty_wskazniki for select using (true);
