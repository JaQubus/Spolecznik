import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./key";

export const publicClientConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY;

/**
 * Klient anon bez sesji: publiczne API widzi to samo co niezalogowany gość (RLS), także gdy zapytanie
 * przyjdzie z ciasteczkami admina. Bez cookies() trasa nie zależy od osoby, więc odpowiedź można cache'ować.
 */
export function createPublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}
