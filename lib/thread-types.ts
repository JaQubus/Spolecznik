// Wspólne dla serwera (lib/threads.ts) i klienta (komponent rozmowy).

export const AUTHOR_ROLES = ["autor", "rops", "ekspert", "ai"] as const;
export type AuthorRole = (typeof AUTHOR_ROLES)[number];

export type ThreadMessage = { id: string; role: AuthorRole; name: string; body: string; createdAt: string };

export const ROLE_LABELS: Record<AuthorRole, string> = {
  autor: "Zgłaszający",
  rops: "ROPS Kraków",
  ekspert: "Ekspert",
  ai: "Asystent AI",
};

/** Kanał Realtime Broadcast wątku. Id wątku znają tylko posiadacz kodu i admin, więc kanał jest publiczny. */
export const channelName = (threadId: string) => `rozmowa:${threadId}`;

/** Zdarzenie na kanale: sam sygnał, bez treści — klient pobiera wątek przez API. */
export const NEW_MESSAGE_EVENT = "nowa";

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
