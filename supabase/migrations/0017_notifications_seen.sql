-- Dzwonek (#21) trzyma stan „widziane” per osoba (ciasteczko z czasem najnowszego obejrzanego powiadomienia),
-- a nie w wierszu powiadomienia: powiadomienie do roli admin to jeden wiersz dla wszystkich adminów, więc jedno
-- read_at oznaczałoby je każdemu. Kolumna i polityka do jej zmiany nie były nigdzie używane — usuwamy je, żeby
-- schemat nie sugerował innego mechanizmu niż ten, który działa.

drop policy if exists "oznaczanie przeczytanych" on notifications;
alter table notifications drop column if exists read_at;
