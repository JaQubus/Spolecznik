// Publiczny klucz Supabase: nowe projekty nazywają go „publishable”, starsze „anon” — przyjmujemy oba.
// Odwołania muszą być dosłowne (process.env.NEXT_PUBLIC_…), żeby Next wstawił wartości do kodu przeglądarki.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
