-- Powiadomienia e-mail dla autorów bez konta (#65). needs.contact_email jest od 0001; pomysły dostają to samo pole.
-- Adres jest nieobowiązkowy, podaje go autor po wysłaniu zgłoszenia (prywatny klucz potwierdza, że to on),
-- i służy tylko do powiadomień o tym zgłoszeniu. Jak needs: RLS bez polityk odczytu dla anon, zapis przez serwer.
alter table ideas add column if not exists contact_email text;
