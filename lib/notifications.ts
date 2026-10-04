import "server-only";
import type { Viewer } from "./auth";
import { NEED_STATUS_LABELS, type NeedStatus } from "./need-status";
import { ADMIN_CHANNEL, NOTIFICATION_EVENT, userChannel, type NotificationItem } from "./notification-types";
import { createAdminClient } from "./supabase/admin";

/** Powiadomienie do jednej osoby (user_id) albo do całej roli (role = 'admin'). */
export type NewNotification =
  | { user_id: string; role?: never; kind: string; payload: Record<string, unknown> }
  | { role: "admin"; user_id?: never; kind: string; payload: Record<string, unknown> };

/** Dzwonek działa tylko z bazą: bez niej nie ma kont ani tabeli notifications. */
export const notificationsEnabled = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Zapis powiadomień i sygnał na kanale odbiorcy, żeby otwarty dzwonek od razu pobrał nową listę
 * (jak w rozmowach: Broadcast bez treści, dane i tak idą przez /api/powiadomienia).
 * Rzuca przy błędzie zapisu — wywołujący decyduje, czy to tylko zalogować. Błąd sygnału tylko logujemy.
 */
export async function notify(rows: NewNotification | NewNotification[]): Promise<void> {
  const list = Array.isArray(rows) ? rows : [rows];
  if (!list.length) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").insert(list);
  if (error) throw error;

  const channels = [...new Set(list.map((n) => (n.role === "admin" ? ADMIN_CHANNEL : userChannel(n.user_id!))))];
  await Promise.all(
    channels.map(async (name) => {
      const channel = supabase.channel(name);
      try {
        const res = await channel.httpSend(NOTIFICATION_EVENT, {});
        if (!res.success) console.error("[powiadomienia] broadcast:", res.error);
      } catch (e) {
        console.error("[powiadomienia] broadcast:", e);
      } finally {
        await supabase.removeChannel(channel);
      }
    }),
  );
}

/** Kanały, których słucha dzwonek tej osoby. */
export function channelsFor(viewer: Viewer): string[] {
  return [...(viewer.role === "admin" ? [ADMIN_CHANNEL] : []), ...(viewer.id ? [userChannel(viewer.id)] : [])];
}

/** Filtr PostgREST: powiadomienia tej osoby i jej roli — to samo co polityka RLS „własne powiadomienia”. */
function audienceFilter(viewer: Viewer): string | null {
  const parts = [...(viewer.role === "admin" ? ["role.eq.admin"] : []), ...(viewer.id ? [`user_id.eq.${viewer.id}`] : [])];
  return parts.length ? parts.join(",") : null;
}

type Row = { id: string; kind: string; payload: Record<string, unknown>; created_at: string; role: string | null };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Treść prostym językiem i link — dla każdego rodzaju zapisywanego w aplikacji. */
function describe(r: Row, codes: Map<string, string>): Pick<NotificationItem, "text" | "href"> {
  const p = r.payload;
  const needId = str(p.needId);
  const code = str(p.statusCode) ?? str(p.code) ?? (needId ? codes.get(needId) ?? null : null);
  const forAdmin = r.role === "admin";
  switch (r.kind) {
    case "nowa_potrzeba":
      return {
        text: `Nowe zgłoszenie${code ? ` ${code}` : ""}${str(p.summary) ? `: ${short(str(p.summary)!)}` : ""}${p.isGap ? " (brak gotowego rozwiązania)" : ""}`,
        href: needId ? `/panel/zgloszenia/${needId}` : "/panel",
      };
    case "nowy_pomysl":
      return { text: `Nowy pomysł${code ? ` ${code}` : ""}${str(p.title) ? `: ${short(str(p.title)!)}` : ""}`, href: "/panel/pomysly" };
    case "nowa_wiadomosc":
      return forAdmin
        ? { text: `Zgłaszający napisał w sprawie ${code ?? "zgłoszenia"}`, href: needId ? `/panel/zgloszenia/${needId}#rozmowa` : "/panel" }
        : { text: `Nowa odpowiedź w sprawie ${code ?? "Twojego zgłoszenia"}`, href: code ? `/zapytaj?potrzeba=${code}` : null };
    case "zmiana_statusu": {
      const label = NEED_STATUS_LABELS[p.status as NeedStatus];
      return { text: `${code ? `Zgłoszenie ${code}` : "Twoje zgłoszenie"} ma nowy status${label ? `: ${label}` : ""}`, href: code ? `/status/${code}` : null };
    }
    case "wiadomosc":
      return { text: `ROPS dodał wiadomość do ${code ? `zgłoszenia ${code}` : "Twojego zgłoszenia"}`, href: code ? `/status/${code}` : null };
    case "nowy_nabor":
      return { text: `Ruszył nabór${str(p.title) ? ` „${short(str(p.title)!)}”` : ""}. Możesz złożyć wniosek.`, href: "/wniosek" };
    default:
      return { text: "Nowe powiadomienie", href: null };
  }
}

/**
 * Ostatnie powiadomienia tej osoby i liczba nowych. `seenAt` to czas najnowszego powiadomienia, które ta osoba
 * już widziała (zapisany przy otwarciu dzwonka) — czas z bazy, więc różnica zegarów serwerów nic nie gubi.
 */
export async function listNotifications(viewer: Viewer, seenAt: string | null, limit = 20) {
  const filter = audienceFilter(viewer);
  if (!filter) return { items: [] as NotificationItem[], unread: 0 };
  const supabase = createAdminClient();

  const unreadQuery = supabase.from("notifications").select("id", { count: "exact", head: true }).or(filter);
  const [list, count] = await Promise.all([
    supabase.from("notifications").select("id, kind, payload, created_at, role").or(filter).order("created_at", { ascending: false }).limit(limit),
    seenAt ? unreadQuery.gt("created_at", seenAt) : unreadQuery,
  ]);
  if (list.error) throw list.error;
  if (count.error) throw count.error;
  const rows = (list.data ?? []) as Row[];

  // Starsze powiadomienia o statusie mają tylko needId — kod zgłoszenia dociągamy jednym zapytaniem.
  const missing = [...new Set(rows.filter((r) => !str(r.payload.statusCode) && !str(r.payload.code)).map((r) => str(r.payload.needId)).filter(Boolean))] as string[];
  const codes = new Map<string, string>();
  if (missing.length) {
    const { data } = await supabase.from("needs").select("id, status_code").in("id", missing);
    for (const n of data ?? []) codes.set(n.id as string, n.status_code as string);
  }

  return {
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      unread: !seenAt || Date.parse(r.created_at) > Date.parse(seenAt),
      ...describe(r, codes),
    })),
    unread: count.count ?? 0,
  };
}
