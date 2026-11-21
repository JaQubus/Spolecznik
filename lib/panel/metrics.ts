// Wskaźniki skuteczności systemu (Panel → Wskaźniki) i białe plamy (powiat × sektor). Czyste funkcje.
import { FUNNEL_KEYS, type FunnelKey } from "../taxonomy.ts";
import { ACTIVE_FUNNEL_STAGES } from "../innovations/institutions.ts";

export type MetricInitiative = {
  id: string;
  created_at: string;
  status: string;
  funnel_stage: string | null;
  submission_kind: string;
  teryt: string | null;
  sectors: readonly string[];
  duplicate_of: string | null;
};
export type MetricContact = { initiative_id: string; created_at: string; updated_at: string; status: string };

const DAY = 86_400_000;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const days = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / DAY;
const round1 = (n: number) => Math.round(n * 10) / 10;

export type DurationStat = { medianDays: number; n: number };

export type SystemMetrics = {
  /** Innowacje bez duplikatów. */
  total: number;
  detected: number;
  /** Wykryte, które ktoś potwierdził albo zespół zweryfikował (etap lejka poza „wykryta” i „zarchiwizowana”). */
  detectedVerified: number;
  /** Innowacje do oceny skuteczności: bez duplikatów, zarchiwizowanych i niepotwierdzonych wykrytych. */
  assessable: number;
  withActivePathway: number;
  /** Odsetek 0–100 albo null, gdy nie ma z czego liczyć. */
  activePathwayPercent: number | null;
  firstContact: DurationStat | null;
  connected: DurationStat | null;
  byStage: Record<FunnelKey, number>;
};

const stageOf = (i: MetricInitiative): FunnelKey => (FUNNEL_KEYS.includes(i.funnel_stage as FunnelKey) ? (i.funnel_stage as FunnelKey) : "wykryta");

export function systemMetrics(initiatives: readonly MetricInitiative[], contacts: readonly MetricContact[]): SystemMetrics {
  const real = initiatives.filter((i) => !i.duplicate_of);
  const byStage = Object.fromEntries(FUNNEL_KEYS.map((k) => [k, 0])) as Record<FunnelKey, number>;
  for (const i of real) byStage[stageOf(i)] += 1;

  const detected = real.filter((i) => i.submission_kind === "detected");
  const detectedVerified = detected.filter((i) => {
    const s = stageOf(i);
    return s !== "wykryta" && s !== "zarchiwizowana";
  });
  const assessable = real.filter((i) => stageOf(i) !== "zarchiwizowana" && i.status !== "detected");
  const withActivePathway = assessable.filter((i) => (ACTIVE_FUNNEL_STAGES as readonly string[]).includes(stageOf(i)));

  const created = new Map(real.map((i) => [i.id, i.created_at]));
  const first = new Map<string, string>();
  const connected = new Map<string, string>();
  for (const c of contacts) {
    if (!created.has(c.initiative_id)) continue;
    if (!first.has(c.initiative_id) || c.created_at < first.get(c.initiative_id)!) first.set(c.initiative_id, c.created_at);
    if (c.status === "polaczone" && (!connected.has(c.initiative_id) || c.updated_at < connected.get(c.initiative_id)!)) connected.set(c.initiative_id, c.updated_at);
  }
  const stat = (m: Map<string, string>): DurationStat | null => {
    const d = [...m].map(([id, at]) => Math.max(0, days(created.get(id)!, at)));
    const med = median(d);
    return med == null ? null : { medianDays: round1(med), n: d.length };
  };

  return {
    total: real.length,
    detected: detected.length,
    detectedVerified: detectedVerified.length,
    assessable: assessable.length,
    withActivePathway: withActivePathway.length,
    activePathwayPercent: assessable.length ? Math.round((withActivePathway.length / assessable.length) * 100) : null,
    firstContact: stat(first),
    connected: stat(connected),
    byStage,
  };
}

export type WhiteSpotRow = { id: string; name: string; counts: Record<string, number>; empty: number };

/**
 * Powiat × sektor: ile innowacji (bez duplikatów, zarchiwizowanych i niepotwierdzonych wykrytych) ma każda para.
 * Biała plama to para bez żadnej innowacji. Wiersze od powiatu z największą liczbą białych plam.
 */
export function whiteSpots(
  initiatives: readonly MetricInitiative[], counties: readonly { id: string; name: string }[], sectors: readonly string[],
): WhiteSpotRow[] {
  const counts = new Map<string, Record<string, number>>(counties.map((c) => [c.id, Object.fromEntries(sectors.map((s) => [s, 0]))]));
  for (const i of initiatives) {
    if (i.duplicate_of || i.status === "archived" || i.status === "detected" || !i.teryt) continue;
    const row = counts.get(i.teryt.slice(0, 4));
    if (!row) continue;
    for (const s of i.sectors) if (s in row) row[s] += 1;
  }
  return counties
    .map((c) => {
      const row = counts.get(c.id)!;
      return { id: c.id, name: c.name, counts: row, empty: sectors.filter((s) => row[s] === 0).length };
    })
    .sort((a, b) => b.empty - a.empty || a.name.localeCompare(b.name, "pl"));
}
