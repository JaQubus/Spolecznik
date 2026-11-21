// Widok lejka PCI: grupowanie innowacji po etapie. Czyste funkcje bez importów serwerowych.
import { FUNNEL_KEYS, type FunnelKey } from "../taxonomy.ts";

export type FunnelItem = {
  id: string;
  status_code: string;
  title: string;
  funnel_stage: string | null;
  signal: number | null;
  institution_name: string | null;
  partner_name: string | null;
  updated_at: string;
};

export type FunnelColumn = { stage: FunnelKey; items: FunnelItem[] };

/** Innowacje bez etapu (baza sprzed 0009) trafiają do pierwszego etapu: nic nie znika z widoku. */
export function groupByStage(items: readonly FunnelItem[]): FunnelColumn[] {
  const columns = FUNNEL_KEYS.map((stage) => ({ stage, items: [] as FunnelItem[] }));
  for (const item of items) {
    const i = FUNNEL_KEYS.indexOf(item.funnel_stage as FunnelKey);
    columns[i < 0 ? 0 : i].items.push(item);
  }
  for (const c of columns) c.items.sort((a, b) => (b.signal ?? -1) - (a.signal ?? -1) || b.updated_at.localeCompare(a.updated_at));
  return columns;
}

/** Etapy, do których można jeszcze przesunąć (advance_funnel idzie tylko do przodu). */
export const laterStages = (current: string | null): FunnelKey[] => {
  const i = FUNNEL_KEYS.indexOf(current as FunnelKey);
  return FUNNEL_KEYS.slice(i + 1);
};
