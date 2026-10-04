"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isTestLoginEnabled, safeNext, TEST_COOKIE, TEST_ROLES, testCookieValue, type TestRole } from "@/lib/auth";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

const field = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : null);

export async function testLogin(formData: FormData) {
  const role = formData.get("rola");
  if (!isTestLoginEnabled() || typeof role !== "string" || !(role in TEST_ROLES)) {
    redirect("/logowanie?blad=test");
  }
  (await cookies()).set(TEST_COOKIE, testCookieValue(role as TestRole), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8,
  });
  const home = role === "admin" ? "/panel" : role === "ekspert" ? "/ekspert" : "/biblioteka";
  const next = field(formData.get("dalej"));
  // Strona logowania domyślnie podaje dalej=/panel — ekspert i mieszkaniec dostaliby tam 403.
  redirect(role !== "admin" && (!next || next.startsWith("/panel")) ? home : safeNext(next, home));
}

export async function passwordLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("haslo") ?? "");
  const next = safeNext(field(formData.get("dalej")));
  if (!email || !password) redirect(`/logowanie?blad=puste&next=${encodeURIComponent(next)}`);
  const { error } = await (await createClient()).auth.signInWithPassword({ email, password });
  if (error) redirect(`/logowanie?blad=haslo&next=${encodeURIComponent(next)}`);
  redirect(next);
}

/** Wylogowanie z konta testowego i z sesji Supabase. */
export async function logout() {
  (await cookies()).delete(TEST_COOKIE);
  if (isSupabaseConfigured()) await (await createClient()).auth.signOut();
  redirect("/logowanie");
}

/** Nazwa używana przez Panel (app/(panel)/panel/layout.tsx). */
export async function signOut() {
  await logout();
}
