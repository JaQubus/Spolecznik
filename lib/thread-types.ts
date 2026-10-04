// Wspólne dla serwera (lib/threads.ts) i klienta (komponent rozmowy).

export const AUTHOR_ROLES = ["autor", "rops", "ekspert", "ai"] as const;
export type AuthorRole = (typeof AUTHOR_ROLES)[number];

/** Źródło odpowiedzi asystenta: strona raportu (PDF) albo opis innowacji w Zasobniku. */
export type MessageSource = {
  kind: "raport" | "innowacja";
  title: string;
  href: string | null;
  page?: number | null;
  year?: number | null;
};

export type ThreadMessage = {
  id: string;
  role: AuthorRole;
  name: string;
  body: string;
  createdAt: string;
  /** Tylko odpowiedzi asystenta (role = "ai") z Zasobnika. */
  sources?: MessageSource[];
};

/** Na kogo czeka rozmowa: na człowieka (asystent przekazał pytanie), pilnie (odpowiedź asystenta nie pomogła) albo na nikogo. */
export type ThreadWaiting = "czlowiek" | "pilne" | null;

export const ROLE_LABELS: Record<AuthorRole, string> = {
  autor: "Zgłaszający",
  rops: "ROPS Kraków",
  ekspert: "Ekspert",
  ai: "Asystent AI",
};

/** Opis pod każdą wiadomością asystenta — tekstem, nie tylko kolorem, więc słyszy go też czytnik ekranu. */
export const AI_DISCLAIMER = "Odpowiedź automatyczna asystenta Społecznika. Pracownik ROPS też ją zobaczy i odpowie, jeśli trzeba.";

/** Link do strony raportu w PDF (jak w „Zapytaj Bibliotekę”). */
export const reportPageHref = (url: string, page?: number | null) => (page ? `${url}#page=${page}` : url);

/** Kanał Realtime Broadcast wątku. Id wątku znają tylko posiadacz kodu i admin, więc kanał jest publiczny. */
export const channelName = (threadId: string) => `rozmowa:${threadId}`;

/** Prywatny link do rozmowy: otwiera ją na innym urządzeniu (app/r/[kod]/[klucz]). */
export const privateLinkPath = (code: string, key: string) => `/r/${code}/${key}`;

/** Zdarzenie na kanale: sam sygnał, bez treści — klient pobiera wątek przez API. */
export const NEW_MESSAGE_EVENT = "nowa";

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
