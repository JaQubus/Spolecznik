import "server-only";
import { createClient } from "./supabase/server";

export type Viewer = { id: string; email: string | null; role: string };

/** Zalogowany użytkownik z rolą z profiles (RLS: każdy widzi własny profil). */
export async function getViewer(): Promise<Viewer | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    return { id: user.id, email: user.email ?? null, role: data?.role ?? "mieszkaniec" };
  } catch {
    return null;
  }
}

/** Dla Server Actions panelu: rzuca, gdy wywołuje je ktoś bez roli admin. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") throw new Error("Brak uprawnień");
  return viewer;
}
