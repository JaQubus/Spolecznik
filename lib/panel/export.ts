// Eksport CSV listy innowacji z Panelu. Czysty moduł: etykiety ze słowników, kolejność kolumn w jednym miejscu.
import { toCsv, type CsvValue } from "../csv.ts";
import { funnelLabel, innovationKindLabel, ipStatusLabel, sectorLabel } from "../taxonomy.ts";

export type ExportRow = {
  status_code: string;
  title: string;
  status: string;
  funnel_stage: string | null;
  innovation_kind: string | null;
  sectors: readonly string[];
  trl: number | null;
  ip_status: string | null;
  signal: number | null;
  signal_override: number | null;
  institution_name: string | null;
  municipality: string | null;
  county: string | null;
  partner_name: string | null;
  published: boolean;
  duplicate_code: string | null;
  created_at: string;
  updated_at: string;
  synthetic: boolean;
};

export const EXPORT_HEADER = [
  "Kod", "Tytuł", "Status", "Etap lejka", "Typ innowacji", "Sektory", "TRL", "Ochrona IP", "Sygnał", "Korekta sygnału", "Instytucja",
  "Gmina", "Powiat", "Partner", "Opublikowana", "Scalona z", "Zgłoszona", "Zmieniona", "Dane syntetyczne",
] as const;

export function exportCsv(rows: readonly ExportRow[], statusText: (s: string) => string): string {
  const body: CsvValue[][] = rows.map((r) => [
    r.status_code, r.title, statusText(r.status), r.funnel_stage ? funnelLabel(r.funnel_stage) : "",
    r.innovation_kind ? innovationKindLabel(r.innovation_kind) : "", r.sectors.map(sectorLabel).join(", "), r.trl,
    r.ip_status ? ipStatusLabel(r.ip_status) : "", r.signal_override ?? r.signal, r.signal_override, r.institution_name, r.municipality,
    r.county, r.partner_name, r.published, r.duplicate_code, r.created_at.slice(0, 10), r.updated_at.slice(0, 10), r.synthetic,
  ]);
  return toCsv([[...EXPORT_HEADER], ...body]);
}
