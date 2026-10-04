-- Plakat pomysłu (wizualizacja z briefu, moduł III): treść z /api/poster, którą autor wygenerował w Pracowni
-- przed zgłoszeniem. Panel → Pomysły rysuje z niej ten sam plakat. Jak reszta ideas: zapis i odczyt przez serwer.
alter table ideas add column if not exists poster jsonb;
