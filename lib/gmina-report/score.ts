// Raport gminy (#104): wszystkie liczby raportu liczy ten kod — model językowy dostaje je gotowe.
// Czyste funkcje bez importów serwerowych (testy: tests/unit/gmina-report.test.ts).
import type { AreaKey } from "../knowledge/types.ts";
import {
  AREA_INDICATORS, FOCUS_COUNT, FOCUS_MIN_SCORE, MIN_COHORT, POPULATION_BINS, SMALL_GMINA,
  type Direction, type Level,
} from "./config.ts";

/** To, czego raport potrzebuje z public/mapa/malopolska.json (lib/knowledge/map.ts → MapData). */
export type Unit = { id: string; name: string; parent: string | null; kind: string | null; values: Record<string, number | null> };
export type IndicatorMeta = {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  question: string;
  source: { title: string; url: string; year: number };
};
export type ReportData = {
  gminy: { units: Unit[]; indicators: IndicatorMeta[] };
  powiaty: { units: Unit[]; indicators: IndicatorMeta[] };
};

export type GminaType = "miejska" | "wiejska" | "miejsko-wiejska";
export type Cohort = { key: string; label: string; type: GminaType; members: string[] };

export type IndicatorRow = {
  key: string;
  label: string;
  question: string;
  unit: string;
  decimals: number;
  level: Level;
  direction: Direction;
  value: number | null;
  /** Mediana gmin podobnych; null dla danych powiatowych (porównujemy wtedy powiaty). */
  cohortMedian: number | null;
  /** Mediana wszystkich gmin (albo wszystkich 22 powiatów przy danych powiatowych). */
  regionMedian: number | null;
  /** Ile jednostek w porównaniu ma niższą / wyższą wartość — do zdań „wyższa niż w 82% gmin podobnych”. */
  lowerPct: number | null;
  higherPct: number | null;
  /** 0–100: jak duża potrzeba na tle porównania, z uwzględnieniem kierunku. 50 = typowo. */
  needPct: number | null;
  comparedWith: number;
  source: { title: string; url: string; year: number };
  /** Opis przeliczenia, gdy liczby nie ma wprost w źródle (np. „na 10 tys. mieszkańców”). */
  derived: string | null;
};

export type AreaRow = { area: AreaKey; level: Level; score: number | null; indicators: IndicatorRow[] };

export type GminaProfile = {
  teryt: string;
  name: string;
  /** „powiat bocheński” albo „Kraków (miasto na prawach powiatu)”, jak parent w danych mapy. */
  powiat: string | null;
  type: GminaType | null;
  population: number | null;
  change10y: number | null;
  share65: number | null;
  small: boolean;
  /** Źródło liczby mieszkańców, zmiany w 10 lat i udziału 65+ (GUS BDL). */
  source: IndicatorMeta["source"] | null;
  cohort: Cohort;
  areas: AreaRow[];
  focus: AreaKey[];
};

/** Typ gminy z 7. cyfry TERYT: 1 miejska, 2 wiejska, 3 miejsko-wiejska (jak gminaType w lib/taxonomy.ts). */
export function typeFromTeryt(teryt: string): GminaType | null {
  return ({ "1": "miejska", "2": "wiejska", "3": "miejsko-wiejska" } as const)[teryt.charAt(6) as "1"] ?? null;
}

const TYPE_LABEL: Record<GminaType, string> = { miejska: "gminy miejskie", wiejska: "gminy wiejskie", "miejsko-wiejska": "gminy miejsko-wiejskie" };

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Grupy porównawcze: typ gminy × przedział ludności. Przedział mniejszy niż MIN_COHORT łączy się z sąsiednim
 * tego samego typu (najpierw z większym), aż grupa jest wystarczająca albo zostaje jeden przedział na typ.
 */
export function buildCohorts(gminy: Unit[]): Cohort[] {
  const cohorts: Cohort[] = [];
  for (const type of Object.keys(TYPE_LABEL) as GminaType[]) {
    let groups = POPULATION_BINS.map((b) => ({
      bins: [b] as (typeof POPULATION_BINS)[number][],
      members: gminy
        .filter((g) => typeFromTeryt(g.id) === type && (g.values.ludnosc ?? 0) >= b.min && (g.values.ludnosc ?? 0) < b.max)
        .map((g) => g.id),
    })).filter((g) => g.members.length > 0);
    for (let i = groups.findIndex((g) => g.members.length < MIN_COHORT); i >= 0 && groups.length > 1;
      i = groups.findIndex((g) => g.members.length < MIN_COHORT)) {
      const j = i + 1 < groups.length ? i + 1 : i - 1;
      const [a, b] = [Math.min(i, j), Math.max(i, j)];
      groups = [...groups.slice(0, a), { bins: [...groups[a].bins, ...groups[b].bins], members: [...groups[a].members, ...groups[b].members] }, ...groups.slice(b + 1)];
    }
    for (const g of groups) {
      const first = g.bins[0];
      const last = g.bins[g.bins.length - 1];
      const range = g.bins.length === 1 ? first.label
        : first.min === 0 && last.max === Infinity ? "wszystkie"
        : first.min === 0 ? `do ${last.max / 1000} tys. mieszkańców`
        : last.max === Infinity ? `od ${first.min / 1000} tys. mieszkańców`
        : `${first.min / 1000}–${last.max / 1000} tys. mieszkańców`;
      cohorts.push({
        key: `${type}:${g.bins.map((b) => b.key).join("+")}`,
        label: range === "wszystkie" ? TYPE_LABEL[type] : `${TYPE_LABEL[type]}, ${range}`,
        type,
        members: g.members,
      });
    }
  }
  return cohorts;
}

const powiatId = (teryt: string) => teryt.slice(0, 4);

/** Ludność powiatów jako suma ludności ich gmin (BDL) — mianownik dla wskaźników „na 10 tys. mieszkańców”. */
function powiatPopulation(gminy: Unit[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of gminy) if (g.values.ludnosc != null) m.set(powiatId(g.id), (m.get(powiatId(g.id)) ?? 0) + g.values.ludnosc);
  return m;
}

/** Część porównywanych wartości niższa / wyższa od value, w procentach (remisy nie liczą się do żadnej). */
function shares(value: number, values: number[]) {
  const lower = values.filter((v) => v < value).length;
  const higher = values.filter((v) => v > value).length;
  const equal = values.length - lower - higher;
  const pct = (n: number) => Math.round((n / values.length) * 100);
  // Percentyl z połową remisów: jedyna wartość w grupie albo wszystkie równe dają 50.
  const above = Math.round(((lower + equal / 2) / values.length) * 100);
  return { lowerPct: pct(lower), higherPct: pct(higher), above };
}

/** Profil gminy z liczbami do raportu. Zwraca null, gdy TERYT nie jest gminą z danych mapy. */
export function profileFor(teryt: string, data: ReportData, cohorts = buildCohorts(data.gminy.units)): GminaProfile | null {
  const unit = data.gminy.units.find((u) => u.id === teryt);
  const cohort = cohorts.find((c) => c.members.includes(teryt));
  if (!unit || !cohort) return null;

  const gminaById = new Map(data.gminy.units.map((u) => [u.id, u]));
  const powiatById = new Map(data.powiaty.units.map((u) => [u.id, u]));
  const popByPowiat = powiatPopulation(data.gminy.units);
  const powiat = powiatById.get(powiatId(teryt)) ?? null;

  const row = (spec: (typeof AREA_INDICATORS)[AreaKey][number]): IndicatorRow | null => {
    const layer = spec.level === "gmina" ? data.gminy : data.powiaty;
    const meta = layer.indicators.find((i) => i.key === spec.key);
    if (!meta) return null;
    const valueOf = (u: Unit) => {
      const v = u.values[spec.key];
      if (v == null) return null;
      if (!spec.per10k) return v;
      const pop = popByPowiat.get(u.id);
      return pop ? (v / pop) * 10_000 : null;
    };
    const own = spec.level === "gmina" ? unit : powiat;
    const value = own ? valueOf(own) : null;
    const region = layer.units.map(valueOf).filter((v): v is number => v != null);
    const peers = spec.level === "gmina"
      ? cohort.members.map((id) => gminaById.get(id)).filter((u): u is Unit => !!u).map(valueOf).filter((v): v is number => v != null)
      : region;
    const s = value != null && peers.length ? shares(value, peers) : null;
    const decimals = spec.per10k ? 1 : meta.decimals;
    return {
      key: spec.key,
      label: meta.label, // jednostka „na 10 tys. mieszkańców” jest przy wartości
      question: meta.question,
      unit: spec.per10k ? "na 10 tys. mieszkańców" : meta.unit,
      decimals,
      level: spec.level,
      direction: spec.direction,
      value: value == null ? null : round(value, decimals),
      cohortMedian: spec.level === "gmina" ? roundOrNull(median(peers), decimals) : null,
      regionMedian: roundOrNull(median(region), decimals),
      lowerPct: s?.lowerPct ?? null,
      higherPct: s?.higherPct ?? null,
      needPct: s ? (spec.direction === "need_up" ? s.above : 100 - s.above) : null,
      comparedWith: peers.length,
      source: meta.source,
      derived: spec.per10k
        ? `wyliczone: ${meta.label.toLowerCase()} (${meta.source.title}, ${meta.source.year}) na 10 tys. mieszkańców powiatu (suma gmin, GUS BDL)`
        : null,
    };
  };

  const areas: AreaRow[] = (Object.keys(AREA_INDICATORS) as AreaKey[]).map((area) => {
    const indicators = AREA_INDICATORS[area].map(row).filter((r): r is IndicatorRow => r != null);
    const scored = indicators.filter((i) => i.needPct != null);
    return {
      area,
      level: indicators[0]?.level ?? "gmina",
      score: scored.length ? Math.round(scored.reduce((s, i) => s + i.needPct!, 0) / scored.length) : null,
      indicators,
    };
  });

  // Najpierw największa potrzeba; przy remisie obszar z danymi gminy, bo dane powiatu mówią o gminie mniej.
  const focus = areas
    .filter((a) => a.score != null && a.score >= FOCUS_MIN_SCORE)
    .sort((a, b) => b.score! - a.score! || (a.level === b.level ? 0 : a.level === "gmina" ? -1 : 1))
    .slice(0, FOCUS_COUNT)
    .map((a) => a.area);

  const population = unit.values.ludnosc ?? null;
  return {
    teryt,
    name: unit.name,
    powiat: unit.parent,
    type: typeFromTeryt(teryt),
    population,
    change10y: unit.values.zmiana_ludnosci_10l ?? null,
    share65: unit.values.udzial_65plus ?? null,
    small: population != null && population < SMALL_GMINA,
    source: data.gminy.indicators.find((i) => i.key === "ludnosc")?.source ?? null,
    cohort,
    areas,
    focus,
  };
}

function round(v: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
const roundOrNull = (v: number | null, decimals: number) => (v == null ? null : round(v, decimals));
