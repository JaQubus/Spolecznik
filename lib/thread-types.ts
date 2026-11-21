import { brand, org } from "@/lib/brand";
// Wspólne dla serwera (lib/threads.ts) i klienta (komponent rozmowy).

export const AUTHOR_ROLES = ["author", "staff", "mentor", "ai"] as const;
export type AuthorRole = (typeof AUTHOR_ROLES)[number];

/** Źródło odpowiedzi asystenta: fakt o regionie z BDL, sprawdzone rozwiązanie albo inicjatywa z bazy. */
export type MessageSource = {
  kind: "fakt" | "rozwiazanie" | "inicjatywa";
  title: string;
  href: string | null;
  year?: number | null;
};

export type ThreadMessage = {
  id: string;
  role: AuthorRole;
  name: string;
  body: string;
  createdAt: string;
  /** Tylko odpowiedzi asystenta (role = "ai"). */
  sources?: MessageSource[];
  /** Ustawia serwer, gdy w wątku pisze kilku autorów (partnerstwo) — sama rola nie mówi, czy to „Ty”. */
  mine?: boolean;
};

/** Na kogo czeka rozmowa: na człowieka (asystent przekazał pytanie), pilnie (odpowiedź asystenta nie pomogła) albo na nikogo. */
export type ThreadWaiting = "czlowiek" | "pilne" | null;

export const ROLE_LABELS: Record<AuthorRole, string> = {
  author: "Autor",
  staff: org.signature,
  mentor: "Mentor",
  ai: "Asystent AI",
};

/** Opis pod każdą wiadomością asystenta — tekstem, nie tylko kolorem, więc słyszy go też czytnik ekranu. */
export const AI_DISCLAIMER = `Odpowiedź automatyczna asystenta ${brand.nameGenitive}. Zespół ${org.short} też ją zobaczy i odpowie, jeśli trzeba.`;

/** Kanał Realtime Broadcast wątku. Id wątku znają tylko posiadacz kodu i admin, więc kanał jest publiczny. */
export const channelName = (threadId: string) => `rozmowa:${threadId}`;

/** Prywatny link do inicjatywy: otwiera rozmowę na innym urządzeniu (app/r/[kod]/[klucz]). */
export const privateLinkPath = (code: string, key: string) => `/r/${code}/${key}`;

/** Zdarzenie na kanale: sam sygnał, bez treści — klient pobiera wątek przez API. */
export const NEW_MESSAGE_EVENT = "nowa";

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
