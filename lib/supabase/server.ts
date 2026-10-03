import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Klient z sesją użytkownika (RLS) — dla Server Components, Server Actions i route handlers. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
