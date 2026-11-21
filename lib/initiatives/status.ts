import type { TimelineStep } from "@/components/ui/status-timeline";
import { formatDate } from "../pl";
import type { InitiativeStatus } from "../schemas";
import { org } from "@/lib/brand";

export type { InitiativeStatus };

export const STATUS_LABELS: Record<InitiativeStatus, string> = {
  submitted: "Zgłoszona",
  in_review: "W analizie",
  featured: "Wyróżniona",
  supported: "Ze wsparciem",
  scaling: "Przenoszona dalej",
  archived: "Zamknięta",
};

/** Kolumna status to zwykły text — nieznaną wartość pokazujemy dosłownie. */
export const statusLabel = (s: string) => STATUS_LABELS[s as InitiativeStatus] ?? s;

/** Zmiana statusu z audit_log (diff.to); note to wiadomość dla autora, widoczna po kodzie. */
export type StatusEvent = { to: InitiativeStatus; at: string; note?: string | null };

const MAIN: InitiativeStatus[] = ["submitted", "in_review", "featured", "supported", "scaling"];

/** Co dzieje się na kroku, który jeszcze nie ma daty ani wiadomości od organizatora. */
const DESCRIPTIONS: Partial<Record<InitiativeStatus, string>> = {
  in_review: `Zespół ${org.short} czyta zgłoszenie i sprawdza ocenę radaru`,
  featured: "Inicjatywa trafia do bazy i na mapę, inni mogą ją znaleźć",
  supported: "Mentor albo program pomaga ją rozwinąć",
  scaling: "Inne gminy i instytucje przenoszą ją do siebie",
};

/** Kroki osi czasu jak śledzenie paczki (StatusTimeline.md): Zgłoszona → W analizie → Wyróżniona → Ze wsparciem → Przenoszona dalej. */
export function initiativeTimeline(createdAt: string, status: InitiativeStatus, events: StatusEvent[]): TimelineStep[] {
  const last = (s: InitiativeStatus) => events.findLast((e) => e.to === s);
  const note = (s: InitiativeStatus) => {
    const e = last(s);
    const at = s === "submitted" ? createdAt : e?.at;
    return [at && formatDate(at), e?.note].filter(Boolean).join(" · ") || undefined;
  };

  // Zamknięcie wychodzi poza główną ścieżkę: pokazujemy kroki, które były, i zamknięcie.
  const path: InitiativeStatus[] =
    status === "archived" ? [...MAIN.filter((s) => s === "submitted" || last(s)), "archived"] : MAIN;
  const current = path.indexOf(status);

  return path.map((s, i) => ({
    title: STATUS_LABELS[s],
    note: (i <= current ? note(s) : undefined) ?? DESCRIPTIONS[s],
    state: i < current ? "done" : i === current ? "current" : "todo",
  }));
}
