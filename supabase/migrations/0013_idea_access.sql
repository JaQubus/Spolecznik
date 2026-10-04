-- Pomysły dostają ten sam tajny klucz co potrzeby (0012_need_access.sql): ciasteczko „Twoje zgłoszenia
-- na tym urządzeniu” i prywatny link /r/[kod]/[klucz], który przenosi pomysł na inne urządzenie.
-- W bazie tylko skrót SHA-256. Starsze pomysły nie mają klucza — dla nich zostaje sam kod statusu.
alter table ideas add column if not exists access_hash text;
