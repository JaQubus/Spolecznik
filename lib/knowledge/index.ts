import "server-only";
import { fileStore } from "./file-store";
import { queries } from "./store";
import { supabaseStore } from "./supabase-store";

export const isSupabaseConfigured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Zasobnik wiedzy: Supabase, gdy są klucze; inaczej pliki content/knowledge (+ zmiany w .data/). */
export const knowledge = queries(isSupabaseConfigured() ? supabaseStore : fileStore);

export type { Knowledge } from "./store";
