import "server-only";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export type Viewer = { id: string; email: string | null; role: string };

/** Ścieżka powrotu po logowaniu — tylko lokalna, żeby link nie przekierował na obcą stronę. */
export function safeNext(next: string | null | undefined, fallback = "/panel"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** Zalogowany użytkownik z rolą z profiles (RLS: każdy widzi własny profil). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    return { id: user.id, email: user.email ?? null, role: data?.role ?? "mieszkaniec" };
  } catch {
    return null; // bez skonfigurowanego Supabase nikt nie jest zalogowany
  }
});

/**
 * Wpuszcza tylko admina ROPS. Wołaj w każdej stronie, akcji serwerowej i route handlerze Panelu:
 * proxy.ts sprawdza wyłącznie zalogowanie, a akcje serwerowe są publicznymi endpointami.
 */
export const requireAdmin = cache(async (): Promise<Viewer> => {
  const viewer = await getViewer();
  if (!viewer) redirect("/logowanie?next=/panel");
  if (viewer.role !== "admin") forbidden();
  return viewer;
});
