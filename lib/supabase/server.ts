import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "./key";

/** Czy są klucze Supabase (.env.local). Bez nich strony z danymi pokazują komunikat zamiast błędu. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

/** PostgREST nie zna tabeli — zwykle migracja nie została jeszcze uruchomiona. */
export function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/** Klient z sesją użytkownika (RLS) — dla Server Components, Server Actions i route handlers. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Wywołane z Server Component — sesję odświeża proxy.ts.
          }
        },
      },
    },
  );
}
