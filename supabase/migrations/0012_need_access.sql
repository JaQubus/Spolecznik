-- Rozmowa o zgłoszeniu jest prywatna: kod SPL-… pokazuje tylko status, do wątku potrzebny jest tajny klucz.
-- Klucz zna przeglądarka, z której wysłano zgłoszenie (ciasteczko), i prywatny link /r/[kod]/[klucz].
-- W bazie tylko skrót SHA-256, więc wyciek tabeli nie otwiera rozmów.
-- Starsze zgłoszenia (w tym syntetyczne) nie mają klucza: ich rozmowy widzi tylko Panel.
alter table needs add column if not exists access_hash text;
