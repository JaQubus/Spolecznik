// Statystyki strony instytucji (/instytucje/[slug]) z opublikowanych innowacji. Czyste funkcje.

export type InstitutionInnovation = {
  signal: number | null;
  sectors: readonly string[];
  funnel_stage: string | null;
};

/** Etapy lejka, w których innowacja „coś już się z nią dzieje” poza opisaniem. */
export const ACTIVE_FUNNEL_STAGES = ["w_realizacji", "wdrozona", "skomercjalizowana"] as const;
const STRONG_SIGNAL = 70;

export type InstitutionStats = {
  total: number;
  strong: number;
  inProgress: number;
  avgSignal: number | null;
  sectors: { sector: string; count: number }[];
};

export function institutionStats(items: readonly InstitutionInnovation[]): InstitutionStats {
  const signals = items.map((i) => i.signal).filter((s): s is number => s != null);
  const sectors = new Map<string, number>();
  for (const i of items) for (const s of i.sectors) sectors.set(s, (sectors.get(s) ?? 0) + 1);
  return {
    total: items.length,
    strong: signals.filter((s) => s >= STRONG_SIGNAL).length,
    inProgress: items.filter((i) => i.funnel_stage != null && (ACTIVE_FUNNEL_STAGES as readonly string[]).includes(i.funnel_stage)).length,
    avgSignal: signals.length ? Math.round(signals.reduce((a, b) => a + b, 0) / signals.length) : null,
    sectors: [...sectors].map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector, "pl")),
  };
}
