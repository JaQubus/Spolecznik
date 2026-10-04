import "server-only";
import { innovationHref } from "@/components/knowledge/tiles";
import { viewerClient, type Viewer } from "./auth";
import { NEED_STATUS_LABELS, type NeedStatus } from "./need-status";
import { ADMIN_CHANNEL, expertChannel, expertRole, NOTIFICATION_EVENT, userChannel, type NotificationItem } from "./notification-types";
import { createAdminClient } from "./supabase/admin";
import { testStatusLabel } from "./test-status";

/** Powiadomienie do jednej osoby (user_id) albo do całej roli (role = 'admin'). */
export type NewNotification =
  | { user_id: string; role?: never; kind: string; payload: Record<string, unknown> }
  | { role: "admin" | ReturnType<typeof expertRole>; user_id?: never; kind: string; payload: Record<string, unknown> };

const channelOf = (n: NewNotification) =>
  n.role === "admin" ? ADMIN_CHANNEL : n.role ? expertChannel(n.role.slice("ekspert:".length)) : userChannel(n.user_id!);

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

  const channels = [...new Set(list.map(channelOf))];
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
/** `expertId` — ekspert bez konta Supabase (konto testowe): jego powiadomienia idą po kluczu roli, nie po user_id. */
export function channelsFor(viewer: Viewer, expertId?: string | null): string[] {
  return [
    ...(viewer.role === "admin" ? [ADMIN_CHANNEL] : []),
    ...(viewer.id ? [userChannel(viewer.id)] : []),
    ...(expertId ? [expertChannel(expertId)] : []),
  ];
}

/** Filtr PostgREST: powiadomienia tej osoby i jej roli — to samo co polityka RLS „własne powiadomienia”. */
function audienceFilter(viewer: Viewer, expertId?: string | null): string | null {
  const parts = [
    ...(viewer.role === "admin" ? ["role.eq.admin"] : []),
    ...(viewer.id ? [`user_id.eq.${viewer.id}`] : []),
    // Dwukropek jest zarezerwowany w filtrze or() PostgREST — wartość w cudzysłowie.
    ...(expertId ? [`role.eq."${expertRole(expertId)}"`] : []),
  ];
  return parts.length ? parts.join(",") : null;
}

type Row = { id: string; kind: string; payload: Record<string, unknown>; created_at: string; role: string | null };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Co zrobił asystent „Zapytaj ROPS” z wiadomością autora (payload.ai, lib/threads.ts). Brak — starsze powiadomienia. */
const ASSISTANT_NOTE: Record<string, string> = {
  odpowiedz: ". Asystent odpowiedział z Zasobnika",
  przekazano: ". Asystent przekazał pytanie — czeka na człowieka",
  bez_pytania: ". To nie pytanie, asystent nie odpowiadał",
};

/** Treść prostym językiem i link — dla każdego rodzaju zapisywanego w aplikacji. */
function describe(r: Row, codes: Map<string, string>): Pick<NotificationItem, "text" | "href"> {
  const p = r.payload;
  const needId = str(p.needId);
  const ideaId = str(p.ideaId);
  const code = str(p.statusCode) ?? str(p.code) ?? (needId ? codes.get(needId) ?? null : null);
  const forAdmin = r.role === "admin";
  // Karta w Panelu: zgłoszenie albo pomysł (rozmowy o pomysłach mają ideaId zamiast needId).
  const panelCard = needId ? `/panel/zgloszenia/${needId}` : ideaId ? `/panel/pomysly/${ideaId}` : null;
  switch (r.kind) {
    case "nowa_potrzeba":
      return {
        text: `Nowe zgłoszenie${code ? ` ${code}` : ""}${str(p.summary) ? `: ${short(str(p.summary)!)}` : ""}${p.isGap ? " (brak gotowego rozwiązania)" : ""}`,
        href: panelCard ?? "/panel",
      };
    case "nowy_pomysl":
      return { text: `Nowy pomysł${code ? ` ${code}` : ""}${str(p.title) ? `: ${short(str(p.title)!)}` : ""}`, href: panelCard ?? "/panel/pomysly" };
    case "nowa_wiadomosc":
      return forAdmin
        ? {
            text: `${ideaId ? "Autor pomysłu" : "Zgłaszający"} napisał w sprawie ${code ?? (ideaId ? "pomysłu" : "zgłoszenia")}${ASSISTANT_NOTE[str(p.ai) ?? ""] ?? ""}`,
            href: panelCard ? `${panelCard}#rozmowa` : "/panel",
          }
        // Strona statusu, nie /zapytaj: rozmowa wymaga klucza z przeglądarki, z której wysłano zgłoszenie,
        // a status działa na każdym urządzeniu po samym kodzie i ma link do rozmowy.
        : { text: `Nowa odpowiedź w sprawie ${code ?? "Twojego zgłoszenia"}`, href: code ? `/status/${code}` : null };
    case "pilne_pytanie":
      return {
        text: `Pilne: odpowiedź asystenta nie pomogła w sprawie ${code ?? (ideaId ? "pomysłu" : "zgłoszenia")}. Czeka na człowieka`,
        href: panelCard ? `${panelCard}#rozmowa` : "/panel",
      };
    case "zmiana_statusu": {
      const label = NEED_STATUS_LABELS[p.status as NeedStatus];
      return { text: `${code ? `Zgłoszenie ${code}` : "Twoje zgłoszenie"} ma nowy status${label ? `: ${label}` : ""}`, href: code ? `/status/${code}` : null };
    }
    case "nowy_test": {
      const what = str(p.title) ? ` „${short(str(p.title)!)}”` : "";
      const where = str(p.gmina) ? ` (${str(p.gmina)})` : "";
      return {
        text: p.status === "zakonczony"
          ? `Nowa ocena testu${what}${where}${typeof p.rating === "number" ? `: ${p.rating} na 5` : ""}`
          : `Nowe zgłoszenie testu${what}${where}`,
        href: str(p.innovationId) ? `/panel/testy?innowacja=${str(p.innovationId)}` : "/panel/testy",
      };
    }
    case "zmiana_statusu_testu":
      return {
        text: `Twój test${str(p.title) ? ` „${short(str(p.title)!)}”` : ""} ma nowy status: ${testStatusLabel(String(p.status))}`,
        href: str(p.slug) ? innovationHref(str(p.slug)!) : null,
      };
    case "wiadomosc":
      return { text: `ROPS dodał wiadomość do ${code ? `zgłoszenia ${code}` : "Twojego zgłoszenia"}`, href: code ? `/status/${code}` : null };
    case "nowa_innowacja":
      return {
        text: `W Bibliotece jest nowe rozwiązanie, które może pasować do ${code ? `zgłoszenia ${code}` : "Twojego zgłoszenia"}${str(p.title) ? `: „${short(str(p.title)!)}”` : ""}`,
        href: str(p.slug) ? innovationHref(str(p.slug)!) : "/biblioteka",
      };
    case "prosba_eksperta":
      return {
        text: `ROPS prosi Cię o pomoc przy ${p.kind === "pomysl" ? "pomyśle" : "zgłoszeniu"}${code ? ` ${code}` : ""}`,
        href: code ? `/ekspert/${code}` : "/ekspert",
      };
    // Partnerstwa: autor trafia na stronę statusu (jak przy nowa_wiadomosc: /partnerstwo wymaga klucza z przeglądarki,
    // z której wysłano zgłoszenie, a status działa wszędzie i ma link do partnerstwa). Admin do Panelu zgłoszenia, które zaprasza.
    case "partnerstwo_zaproszenie":
      return { text: `${str(p.gmina) ?? "Inna gmina"} chce porozmawiać o podobnym problemie`, href: code ? `/status/${code}` : null };
    case "partnerstwo_nowe":
      return {
        text: `${str(p.gmina) ?? "Gmina"} zaprasza inne gminy do partnerstwa${typeof p.invited === "number" ? ` (zaproszenia: ${p.invited})` : ""}`,
        href: needId ? `/panel/zgloszenia/${needId}#partnerstwo` : "/panel",
      };
    case "partnerstwo_dolaczenie":
      return { text: `${str(p.gmina) ?? "Gmina"} dołączyła do partnerstwa`, href: needId ? `/panel/zgloszenia/${needId}#partnerstwo` : "/panel" };
    case "partnerstwo_wiadomosc":
      return forAdmin
        ? { text: `${str(p.gmina) ?? "Gmina"} napisała w partnerstwie`, href: needId ? `/panel/zgloszenia/${needId}#partnerstwo` : "/panel" }
        : { text: "Nowa wiadomość w partnerstwie gmin", href: code ? `/status/${code}` : null };
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
export async function listNotifications(viewer: Viewer, seenAt: string | null, limit = 20, expertId?: string | null) {
  const filter = audienceFilter(viewer, expertId);
  if (!filter) return { items: [] as NotificationItem[], unread: 0 };
  // Konto Supabase czyta własną sesją, więc granicę pilnuje też RLS („własne powiadomienia”), a filtr wyżej jest
  // drugą warstwą. Konta testowe nie mają sesji (działają tylko lokalnie albo z TEST_LOGIN=1) — dla nich service role.
  const supabase = await viewerClient(viewer);

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
