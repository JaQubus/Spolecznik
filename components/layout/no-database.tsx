import { Alert } from "@/components/ui/alert";

/** Komunikat zamiast błędu, gdy aplikacja działa bez kluczy Supabase (np. praca nad samym UI). */
export function NoDatabase() {
  return (
    <Alert title="Brak połączenia z bazą danych">
      <p>
        Ta część pokazuje dane z Supabase, a aplikacja nie ma kluczy. Skopiuj plik .env.example do .env.local,
        uzupełnij adres i klucz projektu, a potem uruchom serwer ponownie.
      </p>
    </Alert>
  );
}
