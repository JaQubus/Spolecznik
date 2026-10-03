import type { TimelineStep } from "@/components/ui/status-timeline";
import { formatDate } from "./pl";
import { NEED_STATUSES } from "./schemas";

export type NeedStatus = (typeof NEED_STATUSES)[number];

export const NEED_STATUS_LABELS: Record<NeedStatus, string> = {
  zgloszone: "Zgłoszone",
  w_analizie: "W analizie",
  ekspert: "Przypisano eksperta",
  odpowiedz: "Odpowiedź",
  luka: "Brak gotowego rozwiązania",
  zamkniete: "Zamknięte",
};

/** Zmiana statusu z audit_log (diff.to); note to wiadomość dla zgłaszającego, widoczna po kodzie. */
export type StatusEvent = { to: NeedStatus; at: string; note?: string | null };

const MAIN: NeedStatus[] = ["zgloszone", "w_analizie", "ekspert", "odpowiedz"];

/** Kroki osi czasu jak śledzenie paczki (StatusTimeline.md): Zgłoszone → W analizie → Przypisano eksperta → Odpowiedź. */
export function needTimeline(createdAt: string, status: NeedStatus, events: StatusEvent[]): TimelineStep[] {
  const last = (s: NeedStatus) => events.findLast((e) => e.to === s);
  const note = (s: NeedStatus) => {
    const e = last(s);
    const at = s === "zgloszone" ? createdAt : e?.at;
    return [at && formatDate(at), e?.note].filter(Boolean).join(" · ") || undefined;
  };

  // Luka i zamknięcie wychodzą poza główną ścieżkę, więc wstawiamy je tam, gdzie są.
  const path: NeedStatus[] =
    status === "luka" ? ["zgloszone", "luka", "w_analizie", "ekspert", "odpowiedz"]
    : status === "zamkniete" ? [...MAIN.filter((s) => s === "zgloszone" || last(s)), "zamkniete"]
    : MAIN;
  const current = path.indexOf(status);

  return path.map((s, i) => ({
    title: NEED_STATUS_LABELS[s],
    note: i <= current ? note(s) : undefined,
    state: i < current ? "done" : i === current ? "current" : "todo",
  }));
}
