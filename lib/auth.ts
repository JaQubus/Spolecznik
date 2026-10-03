import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { createClient, isSupabaseConfigured } from "./supabase/server";

/** id i email są tylko przy sesji Supabase; konto testowe ich nie ma. */
export type Viewer = { id: string | null; email: string | null; role: string; label: string; via: "test" | "supabase" };

/** Ścieżka powrotu po logowaniu — tylko lokalna, żeby link nie przekierował na obcą stronę. */
export function safeNext(next: string | null | undefined, fallback = "/panel"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

// ── Logowanie testowe ───────────────────────────────────────
// Wybór roli jednym przyciskiem na /logowanie. Ciasteczko jest podpisane (HMAC), a rolę i tak sprawdza
// serwer przy każdym żądaniu. Lokalnie działa zawsze; na serwerze tylko z TEST_LOGIN=1 i własnym TEST_LOGIN_SECRET.
export const TEST_COOKIE = "spolecznik-test";
export const TEST_ROLES = { admin: "Administrator ROPS", mieszkaniec: "Mieszkaniec" } as const;
export type TestRole = keyof typeof TEST_ROLES;

const testSecret = (): string | null =>
  process.env.TEST_LOGIN_SECRET ?? (process.env.NODE_ENV !== "production" ? "tylko-lokalnie-do-testow" : null);

export const isTestLoginEnabled = () =>
  (process.env.NODE_ENV !== "production" || process.env.TEST_LOGIN === "1") && testSecret() !== null;

const sign = (value: string) => createHmac("sha256", testSecret()!).update(value).digest("base64url");

export function testCookieValue(role: TestRole): string {
  return `${role}.${sign(role)}`;
}

function verifyTestCookie(raw: string | undefined): TestRole | null {
  if (!raw || !isTestLoginEnabled()) return null;
  const [role, mac] = raw.split(".");
  if (!(role in TEST_ROLES) || !mac) return null;
  const expected = Buffer.from(sign(role));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given) ? (role as TestRole) : null;
}

/** Kto ogląda stronę: konto testowe albo sesja Supabase z rolą z tabeli profiles (RLS: własny profil). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const testRole = verifyTestCookie((await cookies()).get(TEST_COOKIE)?.value);
  if (testRole) return { id: null, email: null, role: testRole, label: `${TEST_ROLES[testRole]} (konto testowe)`, via: "test" };

  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from("profiles").select("role, display_name").eq("id", user.id).maybeSingle();
    return {
      id: user.id,
      email: user.email ?? null,
      role: profile?.role ?? "mieszkaniec",
      label: profile?.display_name ?? user.email ?? "Użytkownik",
      via: "supabase",
    };
  } catch {
    return null;
  }
});

export const isAdmin = async () => (await getViewer())?.role === "admin";

/**
 * Wpuszcza tylko admina ROPS: niezalogowany → logowanie, zalogowany bez roli admina → 403.
 * Wołaj w każdej stronie, akcji serwerowej i route handlerze Panelu: proxy.ts sprawdza wyłącznie zalogowanie,
 * a akcje serwerowe są publicznymi endpointami. Ukrycie linku w UI nie jest zabezpieczeniem.
 */
export async function requireAdmin(nextPath = "/panel"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/logowanie?next=${encodeURIComponent(nextPath)}`);
  if (viewer.role !== "admin") forbidden();
  return viewer;
}
