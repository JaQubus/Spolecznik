import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Czy są klucze Supabase (.env.local). Bez nich strony z danymi pokazują komunikat zamiast błędu. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
}

/** PostgREST nie zna tabeli — zwykle migracja nie została jeszcze uruchomiona. */
export function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/** Klient z sesją użytkownika (RLS) — dla Server Components, Server Actions i route handlers. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
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
