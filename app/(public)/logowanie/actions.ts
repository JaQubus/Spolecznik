"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isTestLoginEnabled, TEST_COOKIE, TEST_ROLES, testCookieValue, type TestRole } from "@/lib/auth";

/** Tylko ścieżki wewnątrz serwisu — bez otwartego przekierowania na obce strony. */
const safeNext = (v: FormDataEntryValue | null, fallback: string) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
};

export async function testLogin(formData: FormData) {
  const role = formData.get("rola");
  if (!isTestLoginEnabled() || typeof role !== "string" || !(role in TEST_ROLES)) {
    redirect("/logowanie?blad=test");
  }
  (await cookies()).set(TEST_COOKIE, testCookieValue(role as TestRole), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8,
  });
  redirect(safeNext(formData.get("dalej"), role === "admin" ? "/panel/trendy" : "/biblioteka"));
}

export async function passwordLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("haslo") ?? "");
  const next = safeNext(formData.get("dalej"), "/panel");
  if (!email || !password) redirect(`/logowanie?blad=puste&dalej=${encodeURIComponent(next)}`);
  const { createClient } = await import("@/lib/supabase/server");
  const { error } = await (await createClient()).auth.signInWithPassword({ email, password });
  if (error) redirect(`/logowanie?blad=haslo&dalej=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function logout() {
  (await cookies()).delete(TEST_COOKIE);
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const { createClient } = await import("@/lib/supabase/server");
    await (await createClient()).auth.signOut();
  }
  redirect("/logowanie");
}
