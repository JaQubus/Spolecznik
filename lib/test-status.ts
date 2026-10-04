import { TEST_STATUSES } from "./schemas";

export type TestStatus = (typeof TEST_STATUSES)[number];

export const TEST_STATUS_LABELS: Record<TestStatus, string> = {
  planowany: "Zgłoszony",
  potwierdzony: "Pilotaż potwierdzony",
  zakonczony: "Zakończony",
};
