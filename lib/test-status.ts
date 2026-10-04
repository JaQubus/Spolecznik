import { TEST_STATUSES } from "./schemas";

export type TestStatus = (typeof TEST_STATUSES)[number];

export const TEST_STATUS_LABELS: Record<TestStatus, string> = {
  planowany: "Czeka na potwierdzenie",
  potwierdzony: "Pilotaż potwierdzony",
  w_trakcie: "W trakcie",
  zakonczony: "Zakończony",
};

/** Kolumna status w tests to zwykły text — nieznaną wartość pokazujemy dosłownie. */
export const testStatusLabel = (s: string) => TEST_STATUS_LABELS[s as TestStatus] ?? s;
