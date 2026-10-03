/**
 * Klucz publiczny Supabase: „anon” (starsze projekty) albo „publishable” (nowy panel). Wystarczy jeden.
 * `||`, nie `??`: pusta linia `NEXT_PUBLIC_SUPABASE_ANON_KEY=` z .env.example daje "", a nie undefined.
 * Pełne nazwy process.env.NEXT_PUBLIC_* są potrzebne, żeby Next wstawił je do kodu przeglądarki.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
