import "server-only";
import { viewerClient, type Viewer } from "./auth";
import { adoptionStatusLabel } from "./adoption-status";
import { statusLabel } from "./initiatives/status";
import { ADMIN_CHANNEL, mentorChannel, mentorRole, NOTIFICATION_EVENT, userChannel, type NotificationItem } from "./notification-types";
import { createAdminClient } from "./supabase/admin";
import { org } from "@/lib/brand";

/** Powiadomienie do jednej osoby (user_id) albo do całej roli (role = 'admin' albo 'mentor:<id>'). */
export type NewNotification =
  | { user_id: string; role?: never; kind: string; payload: Record<string, unknown> }
  | { role: "admin" | ReturnType<typeof mentorRole>; user_id?: never; kind: string; payload: Record<string, unknown> };

const channelOf = (n: NewNotification) =>
  n.role === "admin" ? ADMIN_CHANNEL : n.role ? mentorChannel(n.role.slice("mentor:".length)) : userChannel(n.user_id!);

/** Dzwonek działa tylko z bazą: bez niej nie ma kont ani tabeli notifications. */
export const notificationsEnabled = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Zapis powiadomień i sygnał na kanale odbiorcy, żeby otwarty dzwonek od razu pobrał nową listę
 * (jak w rozmowach: Broadcast bez treści, dane i tak idą przez /api/notifications).
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

/** Kanały, których słucha dzwonek tej osoby. `mentorId` — mentor bez konta Supabase (konto testowe). */
export function channelsFor(viewer: Viewer, mentorId?: string | null): string[] {
  return [
    ...(viewer.role === "admin" ? [ADMIN_CHANNEL] : []),
    ...(viewer.id ? [userChannel(viewer.id)] : []),
    ...(mentorId ? [mentorChannel(mentorId)] : []),
  ];
}

/** Filtr PostgREST: powiadomienia tej osoby i jej roli — to samo co polityka RLS „własne powiadomienia”. */
function audienceFilter(viewer: Viewer, mentorId?: string | null): string | null {
  const parts = [
    ...(viewer.role === "admin" ? ["role.eq.admin"] : []),
    ...(viewer.id ? [`user_id.eq.${viewer.id}`] : []),
    // Dwukropek jest zarezerwowany w filtrze or() PostgREST — wartość w cudzysłowie.
    ...(mentorId ? [`role.eq."${mentorRole(mentorId)}"`] : []),
  ];
  return parts.length ? parts.join(",") : null;
}

type Row = { id: string; kind: string; payload: Record<string, unknown>; created_at: string; role: string | null };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Co zrobił asystent z wiadomością autora (payload.ai, lib/threads.ts). */
const ASSISTANT_NOTE: Record<string, string> = {
  odpowiedz: ". Asystent odpowiedział z bazy wiedzy",
  przekazano: ". Asystent przekazał pytanie — czeka na człowieka",
  bez_pytania: ". To nie pytanie, asystent nie odpowiadał",
};

/** Treść prostym językiem i link — dla każdego rodzaju zapisywanego w aplikacji. */
function describe(r: Row): Pick<NotificationItem, "text" | "href"> {
  const p = r.payload;
  const initiativeId = str(p.initiativeId);
  const code = str(p.statusCode) ?? str(p.code);
  const forAdmin = r.role === "admin";
  const panelCard = initiativeId ? `/panel/inicjatywy/${initiativeId}` : null;
  switch (r.kind) {
    case "nowa_inicjatywa":
      return {
        text: `${p.submissionKind === "nomination" ? "Nowe wskazanie" : "Nowe zgłoszenie"}${code ? ` ${code}` : ""}${str(p.title) ? `: ${short(str(p.title)!)}` : ""}`,
        href: panelCard ?? "/panel",
      };
    case "wyzwanie_bez_rozwiazania":
      return { text: `Instytucja szuka rozwiązania, którego nie ma w bazie${str(p.summary) ? `: ${short(str(p.summary)!)}` : ""}`, href: "/panel/mapa" };
    case "nowa_wiadomosc":
      return forAdmin
        ? {
            text: `Autor napisał w sprawie ${code ?? "inicjatywy"}${ASSISTANT_NOTE[str(p.ai) ?? ""] ?? ""}`,
            href: panelCard ? `${panelCard}#rozmowa` : "/panel",
          }
        // Strona statusu, nie /rozmowy: rozmowa wymaga klucza z przeglądarki, z której wysłano zgłoszenie,
        // a status działa na każdym urządzeniu po samym kodzie i ma link do rozmowy.
        : { text: `Nowa odpowiedź w sprawie ${code ?? "Twojego zgłoszenia"}`, href: code ? `/status/${code}` : null };
    case "pilne_pytanie":
      return {
        text: `Pilne: odpowiedź asystenta nie pomogła w sprawie ${code ?? "inicjatywy"}. Czeka na człowieka`,
        href: panelCard ? `${panelCard}#rozmowa` : "/panel",
      };
    case "zmiana_statusu":
      return {
        text: `${code ? `Zgłoszenie ${code}` : "Twoje zgłoszenie"} ma nowy status: ${statusLabel(String(p.status))}`,
        href: code ? `/status/${code}` : null,
      };
    case "nowa_adopcja": {
      const what = str(p.title) ? ` „${short(str(p.title)!)}”` : "";
      const where = str(p.gmina) ? ` (${str(p.gmina)})` : "";
      return {
        text: p.status === "zakonczony"
          ? `Nowa ocena przeniesienia${what}${where}${typeof p.rating === "number" ? `: ${p.rating} na 5` : ""}`
          : `Ktoś przenosi do siebie${what}${where}`,
        href: "/panel/adopcje",
      };
    }
    case "zmiana_statusu_adopcji":
      return {
        text: `Wasze przeniesienie${str(p.title) ? ` „${short(str(p.title)!)}”` : ""} ma nowy status: ${adoptionStatusLabel(String(p.status))}`,
        href: str(p.href),
      };
    case "wiadomosc":
      return { text: `${org.short} dodał wiadomość do ${code ? `zgłoszenia ${code}` : "Twojego zgłoszenia"}`, href: code ? `/status/${code}` : null };
    case "prosba_mentora":
      return { text: `${org.short} prosi Cię o pomoc przy inicjatywie${code ? ` ${code}` : ""}`, href: code ? `/mentor/${code}` : "/mentor" };
    // Partnerstwa: autor trafia na stronę statusu (/partnerstwo wymaga klucza z przeglądarki, z której wysłano
    // zgłoszenie, a status działa wszędzie i ma link do partnerstwa). Admin do Panelu inicjatywy, która zaprasza.
    case "partnerstwo_zaproszenie":
      return { text: `${str(p.gmina) ?? "Inna gmina"} chce porozmawiać o podobnej inicjatywie`, href: code ? `/status/${code}` : null };
    case "partnerstwo_nowe":
      return {
        text: `${str(p.gmina) ?? "Autor"} zaprasza autorów podobnych inicjatyw do partnerstwa${typeof p.invited === "number" ? ` (zaproszenia: ${p.invited})` : ""}`,
        href: panelCard ? `${panelCard}#partnerstwo` : "/panel",
      };
    case "partnerstwo_dolaczenie":
      return { text: `${str(p.gmina) ?? "Autor"} dołączył do partnerstwa`, href: panelCard ? `${panelCard}#partnerstwo` : "/panel" };
    case "partnerstwo_wiadomosc":
      return forAdmin
        ? { text: `${str(p.gmina) ?? "Autor"} napisał w partnerstwie`, href: panelCard ? `${panelCard}#partnerstwo` : "/panel" }
        : { text: "Nowa wiadomość w partnerstwie", href: code ? `/status/${code}` : null };
    case "nowy_program":
      return { text: `Ruszył program${str(p.title) ? ` „${short(str(p.title)!)}”` : ""}. Możesz złożyć wniosek.`, href: "/wniosek" };
    default:
      return { text: "Nowe powiadomienie", href: null };
  }
}

/**
 * Ostatnie powiadomienia tej osoby i liczba nowych. `seenAt` to czas najnowszego powiadomienia, które ta osoba
 * już widziała (zapisany przy otwarciu dzwonka) — czas z bazy, więc różnica zegarów serwerów nic nie gubi.
 */
export async function listNotifications(viewer: Viewer, seenAt: string | null, limit = 20, mentorId?: string | null) {
  const filter = audienceFilter(viewer, mentorId);
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

  return {
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      unread: !seenAt || Date.parse(r.created_at) > Date.parse(seenAt),
      ...describe(r),
    })),
    unread: count.count ?? 0,
  };
}
