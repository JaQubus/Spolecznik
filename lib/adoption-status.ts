import { ADOPTION_STATUSES } from "./schemas";

export type AdoptionStatus = (typeof ADOPTION_STATUSES)[number];

export const ADOPTION_STATUS_LABELS: Record<AdoptionStatus, string> = {
  planowany: "Czeka na potwierdzenie",
  potwierdzony: "Przeniesienie potwierdzone",
  w_trakcie: "W trakcie",
  zakonczony: "Zakończone",
};

/** Kolumna status w adoptions to zwykły text — nieznaną wartość pokazujemy dosłownie. */
export const adoptionStatusLabel = (s: string) => ADOPTION_STATUS_LABELS[s as AdoptionStatus] ?? s;
