import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

/** Klient z sesją użytkownika (RLS) — dla Server Components, Server Actions i route handlers. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL!,
    SUPABASE_PUBLIC_KEY!,
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
