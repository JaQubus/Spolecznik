// Wspólne dla serwera (lib/threads.ts) i klienta (komponent rozmowy).

export const AUTHOR_ROLES = ["autor", "rops", "ekspert", "ai"] as const;
export type AuthorRole = (typeof AUTHOR_ROLES)[number];

/** `mine` ustawia serwer, gdy w wątku pisze kilku autorów (partnerstwo) — sama rola nie mówi, czy to „Ty”. */
export type ThreadMessage = { id: string; role: AuthorRole; name: string; body: string; createdAt: string; mine?: boolean };

export const ROLE_LABELS: Record<AuthorRole, string> = {
  autor: "Zgłaszający",
  rops: "ROPS Kraków",
  ekspert: "Ekspert",
  ai: "Asystent AI",
};

/** Kanał Realtime Broadcast wątku. Id wątku znają tylko posiadacz kodu i admin, więc kanał jest publiczny. */
export const channelName = (threadId: string) => `rozmowa:${threadId}`;

/** Prywatny link do rozmowy: otwiera ją na innym urządzeniu (app/r/[kod]/[klucz]). */
export const privateLinkPath = (code: string, key: string) => `/r/${code}/${key}`;

/** Zdarzenie na kanale: sam sygnał, bez treści — klient pobiera wątek przez API. */
export const NEW_MESSAGE_EVENT = "nowa";

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
