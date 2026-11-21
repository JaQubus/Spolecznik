// Filtry listy Radar w Panelu: wspólne dla strony i eksportu CSV. Czysty moduł.
import type { InitiativeStatus } from "../schemas.ts";

export type PanelFilter = { key: string; label: string; statuses: InitiativeStatus[] | null; waiting?: true; merged?: true };

export const PANEL_FILTERS: PanelFilter[] = [
  { key: "nowe", label: "Do przejrzenia", statuses: ["submitted"] },
  // Kandydaci z publicznych źródeł (7/10): czekają na przejęcie przez twórcę albo weryfikację.
  { key: "wykryte", label: "Wykryte w źródłach", statuses: ["detected"] },
  // Rozmowy, w których asystent przekazał pytanie albo jego odpowiedź nie pomogła.
  { key: "czeka", label: "Czekają na człowieka", statuses: null, waiting: true },
  { key: "w_analizie", label: "W analizie", statuses: ["in_review"] },
  { key: "wyroznione", label: "Wyróżnione", statuses: ["featured"] },
  { key: "wsparcie", label: "Ze wsparciem", statuses: ["supported"] },
  { key: "przenoszone", label: "Przenoszone dalej", statuses: ["scaling"] },
  { key: "zamkniete", label: "Zamknięte", statuses: ["archived"] },
  { key: "wszystkie", label: "Wszystkie", statuses: null },
  // Zgłoszenia scalone z inną inicjatywą (duplicate_of, 9/10): znikają z pozostałych list, tu można cofnąć scalenie.
  { key: "scalone", label: "Scalone duplikaty", statuses: null, merged: true },
];
