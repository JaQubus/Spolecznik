// Mapa Małopolski: typy pliku public/mapa/malopolska.json (generuje data/knowledge_map.py) i podział na klasy.
import { formatNumber } from "@/lib/pl";
import type { AreaKey } from "./types";

export type MapIndicator = {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  scale: "sequential" | "diverging";
  area: AreaKey | null;
  category: string;
  question: string;
  source: { title: string; url: string; year: number };
};

export type MapUnit = {
  id: string;
  name: string;
  parent: string | null;
  kind: string | null;
  d: string;
  values: Record<string, number | null>;
};

export type MapLayer = { label: string; units: MapUnit[]; indicators: MapIndicator[] };

export type MapData = {
  viewBox: string;
  outline: string;
  labels: { name: string; x: number; y: number }[];
  geometrySource: { title: string; url: string };
  layers: { gminy: MapLayer; powiaty: MapLayer };
};

export type LayerKey = keyof MapData["layers"];

export type MapClass = { fill: string; label: string; test: (v: number) => boolean };

/*
 * Kolory klas: tokeny --map-red-* / --map-blue-* z app/globals.css, osobno dobrane dla trybu jasnego, ciemnego
 * i wysokiego kontrastu. Każde ramię sprawdzone walidatorem dataviz (--ordinal): jasność zmienia się monotonicznie,
 * klasa najbliżej zera ma ≥ 2:1 do tła. Kolor nigdy nie jest jedyną informacją: wartość jest w podpowiedzi,
 * panelu szczegółów, rankingu i tabeli.
 */
const RED = [1, 2, 3, 4, 5].map((i) => `var(--map-red-${i})`);
const BLUE = [1, 2, 3, 4].map((i) => `var(--map-blue-${i})`);

export const fmt = (v: number, ind: MapIndicator) => formatNumber(v, ind.decimals);
export const withUnit = (v: number, ind: MapIndicator) =>
  ind.unit === "%" ? `${fmt(v, ind)}%` : `${fmt(v, ind)} ${ind.unit}`;
const signed = (v: number, ind: MapIndicator) => `${v > 0 ? "+" : ""}${withUnit(v, ind)}`;

/** „Okrągły” krok progów: 1, 2, 2,5 albo 5 razy potęga dziesięciu. */
function niceStep(x: number) {
  const p = 10 ** Math.floor(Math.log10(x));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= x) ?? 10 * p;
}

/**
 * Skala rozbieżna z jasnymi kolorami przy zerze: na minus niebiesko, na plus czerwono. Krok progów wynika z typowych
 * wartości (90. percentyl odchylenia od zera), a liczba klas po każdej stronie idzie za zakresem danych — dłuższe
 * ramię ma więcej, coraz ciemniejszych stopni (najwyżej 4), ostatnia klasa jest otwarta („i więcej”).
 */
function diverging(values: number[], ind: MapIndicator): MapClass[] {
  const abs = values.map(Math.abs).sort((a, b) => a - b);
  const step = niceStep(Math.max(abs[Math.floor(abs.length * 0.9)] / 3, 10 ** -ind.decimals));
  const arm = (extreme: number) => Math.min(4, Math.max(1, Math.ceil(extreme / step)));
  const nNeg = values.some((v) => v < 0) ? arm(-Math.min(...values)) : 0;
  const nPos = values.some((v) => v >= 0) ? arm(Math.max(...values)) : 0;
  const neg: MapClass[] = Array.from({ length: nNeg }, (_, i) => {
    const hi = i === 0 ? 0 : -i * step, lo = -(i + 1) * step, last = i === nNeg - 1;
    return {
      fill: BLUE[i],
      label: last ? (i === 0 ? "poniżej zera" : `${withUnit(hi, ind)} i mniej`) : `od ${withUnit(lo, ind)} do ${withUnit(hi, ind)}`,
      test: (v: number) => v < hi && (last || v >= lo),
    };
  }).reverse();
  const pos: MapClass[] = Array.from({ length: nPos }, (_, i) => {
    const lo = i * step, hi = (i + 1) * step, last = i === nPos - 1;
    return {
      fill: RED[i],
      label: last ? `${i === 0 ? "0" : signed(lo, ind)} i więcej` : `od ${i === 0 ? "0" : signed(lo, ind)} do ${signed(hi, ind)}`,
      test: (v: number) => v >= lo && (last || v < hi),
    };
  });
  return [...neg, ...pos];
}

/** Kolory dla n klas z 5-stopniowej rampy, rozłożone równo (n = 3 → stopnie 1, 3, 5). */
const spread = (n: number) => Array.from({ length: n }, (_, i) => RED[n === 1 ? 2 : Math.round((i * 4) / (n - 1))]);

/** Kwintyle dla skali „więcej = czerwieniej”; przy kilku różnych wartościach (np. liczba placówek) — klasa na wartość. */
export function classify(values: number[], ind: MapIndicator): MapClass[] {
  if (ind.scale === "diverging") return diverging(values, ind);
  const sorted = [...values].sort((a, b) => a - b);
  const unique = [...new Set(sorted)];
  if (unique.length <= 5) {
    const fills = spread(unique.length);
    return unique.map((u, i) => ({ fill: fills[i], label: withUnit(u, ind), test: (v: number) => v === u }));
  }
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const edges = [...new Set([sorted[0], q(0.2), q(0.4), q(0.6), q(0.8), sorted.at(-1)!])];
  const fills = spread(edges.length - 1);
  return fills.map((fill, i) => ({
    fill,
    label: `od ${fmt(edges[i], ind)} do ${withUnit(edges[i + 1], ind)}`,
    test: (v: number) => (i === 0 || v >= edges[i]) && (i === fills.length - 1 || v < edges[i + 1]),
  }));
}

export const NO_DATA_FILL = "url(#mapa-brak-danych)";

/** Jednostki z danymi, od najwyższej wartości. */
export const ranked = (units: MapUnit[], key: string) =>
  units.filter((u) => u.values[key] != null).sort((a, b) => (b.values[key] as number) - (a.values[key] as number));

/** Miejsce w rankingu (1 = najwyższa wartość) — opis słowny zamiast samego koloru. */
export function rank(units: MapUnit[], key: string, id: string): { place: number; of: number } | null {
  const list = ranked(units, key);
  const place = list.findIndex((u) => u.id === id);
  return place < 0 ? null : { place: place + 1, of: list.length };
}
