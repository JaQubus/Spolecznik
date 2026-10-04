import { cookies } from "next/headers";
import { getViewer, type Viewer } from "@/lib/auth";
import type { NotificationsResponse } from "@/lib/notification-types";
import { channelsFor, listNotifications, notificationsEnabled } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";

/**
 * „Widziane do” zapisujemy w ciasteczku, nie w notifications.read_at: powiadomienia do całej roli admin
 * mają jedno read_at, więc jeden admin oznaczałby je wszystkim. Wartość to „kto|czas”, żeby po zmianie
 * konta w tej samej przeglądarce nie przenosić cudzego stanu.
 */
const SEEN_COOKIE = "spolecznik-powiadomienia";
const viewerKey = (v: Viewer) => v.id ?? `test-${v.role}`;
// Czas dokładnie tak, jak zwraca go Postgres (z mikrosekundami): Date by je obciął i to samo powiadomienie
// liczyłoby się dalej jako nowe.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

async function readSeen(viewer: Viewer): Promise<string | null> {
  const raw = (await cookies()).get(SEEN_COOKIE)?.value;
  if (!raw) return null;
  const [who, at] = raw.split("|");
  return who === viewerKey(viewer) && at && TIMESTAMP.test(at) ? at : null;
}

const off = () => Response.json({ enabled: false } satisfies NotificationsResponse, { headers: { "Cache-Control": "no-store" } });

/** Lista do dzwonka: tylko dla zalogowanych (konto Supabase albo testowe), filtrowana po osobie i roli. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "powiadomienia", 60);
  if (limited) return limited;
  const viewer = await getViewer();
  if (!viewer || !notificationsEnabled()) return off();
  try {
    const { items, unread } = await listNotifications(viewer, await readSeen(viewer));
    return Response.json(
      { enabled: true, items, unread, channels: channelsFor(viewer) } satisfies NotificationsResponse,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[powiadomienia]", e);
    return off();
  }
}

/** Otwarcie dzwonka: „widziane do” = czas najnowszego pokazanego powiadomienia (nie cofamy się). */
export async function POST(request: Request) {
  const limited = rateLimit(request, "powiadomienia-widziane", 30);
  if (limited) return limited;
  const viewer = await getViewer();
  if (!viewer) return new Response(null, { status: 401 });

  const body = (await request.json().catch(() => null)) as { seenAt?: unknown } | null;
  const seenAt = typeof body?.seenAt === "string" && TIMESTAMP.test(body.seenAt) ? body.seenAt : null;
  if (!seenAt || Date.parse(seenAt) > Date.now() + 5 * 60_000) return Response.json({ error: "Nieprawidłowa data" }, { status: 400 });

  const previous = await readSeen(viewer);
  if (previous && Date.parse(previous) > Date.parse(seenAt)) return new Response(null, { status: 204 });
  (await cookies()).set(SEEN_COOKIE, `${viewerKey(viewer)}|${seenAt}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return new Response(null, { status: 204 });
}
