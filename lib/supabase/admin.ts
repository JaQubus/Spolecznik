import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Klient service_role — omija RLS. Tylko po stronie serwera. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local (Supabase → Settings → API Keys)");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
