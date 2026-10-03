import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

export type Viewer = { role: string; label: string; via: "test" | "supabase" };

// ── Logowanie testowe ───────────────────────────────────────
// Do czasu wdrożenia Supabase Auth: wybór roli jednym przyciskiem na /logowanie. Ciasteczko jest podpisane
// (HMAC), a rolę i tak sprawdza serwer przy każdym żądaniu. Lokalnie działa zawsze; na serwerze tylko
// z TEST_LOGIN=1 i własnym TEST_LOGIN_SECRET.
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

const supabaseConfigured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Kto ogląda stronę: konto testowe albo sesja Supabase z rolą z tabeli profiles. */
export async function getViewer(): Promise<Viewer | null> {
  const testRole = verifyTestCookie((await cookies()).get(TEST_COOKIE)?.value);
  if (testRole) return { role: testRole, label: `${TEST_ROLES[testRole]} (konto testowe)`, via: "test" };

  if (!supabaseConfigured()) return null;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, display_name").eq("id", user.id).maybeSingle();
  return { role: profile?.role ?? "mieszkaniec", label: profile?.display_name ?? user.email ?? "Użytkownik", via: "supabase" };
}

export const isAdmin = async () => (await getViewer())?.role === "admin";

/**
 * Strony panelu: niezalogowany → logowanie; zalogowany bez roli admina → 404 (nie zdradzamy, że strona istnieje).
 * Sprawdzane na serwerze — ukrycie linku w UI nie jest zabezpieczeniem.
 */
export async function requireAdmin(nextPath: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/logowanie?dalej=${encodeURIComponent(nextPath)}`);
  if (viewer.role !== "admin") notFound();
  return viewer;
}
