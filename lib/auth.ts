import "server-only";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

/** Ścieżka powrotu po logowaniu — tylko lokalna, żeby link nie przekierował na obcą stronę. */
export function safeNext(next: string | null | undefined, fallback = "/panel"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export const getUser = cache(async () => {
  // Jak w proxy.ts: bez skonfigurowanego Supabase (praca nad samym UI) nikt nie jest zalogowany.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

/**
 * Wpuszcza tylko admina ROPS. Wołaj w każdej stronie, akcji serwerowej i route handlerze Panelu:
 * proxy.ts sprawdza wyłącznie zalogowanie, a akcje serwerowe są publicznymi endpointami.
 */
export const requireAdmin = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/logowanie?next=/panel");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") forbidden();
  return user;
});
