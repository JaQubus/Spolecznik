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
 * Kolory klas: pochodne tokenów design systemu (color-mix), więc same dopasowują się do trybu ciemnego
 * i wysokiego kontrastu. Sprawdzone walidatorem dataviz (tryb --ordinal): jasność rośnie monotonicznie,
 * najjaśniejsza klasa ma ≥ 2:1 do tła, kroki są rozróżnialne. Kolor nigdy nie jest jedyną informacją:
 * wartość jest w podpowiedzi, panelu szczegółów i tabeli.
 */
const SEQUENTIAL = [34, 48, 62, 76, 90].map((p) => `color-mix(in oklab, var(--ink) ${p}%, var(--surface))`);
const DECLINE = [94, 68, 42].map((p) => `color-mix(in oklab, var(--ink) ${p}%, var(--surface-sunken))`);
const GROWTH = [45, 70, 95].map((p) => `color-mix(in oklab, var(--brand) ${p}%, var(--surface-sunken))`);
const NEUTRAL = "var(--surface-sunken)";

export const fmt = (v: number, ind: MapIndicator) => formatNumber(v, ind.decimals);
export const withUnit = (v: number, ind: MapIndicator) =>
  ind.unit === "%" ? `${fmt(v, ind)}%` : `${fmt(v, ind)} ${ind.unit}`;

/** Kwintyle dla skali „więcej = ciemniej”; dla zmian — progi symetryczne wokół zera (spadek / wzrost). */
export function classify(values: number[], ind: MapIndicator): MapClass[] {
  if (ind.scale === "diverging") {
    const t = [10, 4, 1];
    const p = (v: number) => `${v > 0 ? "+" : ""}${formatNumber(v, 0)}%`;
    return [
      { fill: DECLINE[0], label: `spadek o ${t[0]}% i więcej`, test: (v) => v <= -t[0] },
      { fill: DECLINE[1], label: `spadek od ${t[1]} do ${t[0]}%`, test: (v) => v > -t[0] && v <= -t[1] },
      { fill: DECLINE[2], label: `spadek od ${t[2]} do ${t[1]}%`, test: (v) => v > -t[1] && v <= -t[2] },
      { fill: NEUTRAL, label: `bez dużych zmian (od ${p(-t[2])} do ${p(t[2])})`, test: (v) => v > -t[2] && v < t[2] },
      { fill: GROWTH[0], label: "wzrost od 1 do 5%", test: (v) => v >= 1 && v < 5 },
      { fill: GROWTH[1], label: "wzrost od 5 do 15%", test: (v) => v >= 5 && v < 15 },
      { fill: GROWTH[2], label: "wzrost o 15% i więcej", test: (v) => v >= 15 },
    ];
  }
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const breaks = [q(0.2), q(0.4), q(0.6), q(0.8)];
  const edges = [sorted[0], ...breaks, sorted.at(-1)!];
  return SEQUENTIAL.map((fill, i) => ({
    fill,
    label: `od ${fmt(edges[i], ind)} do ${withUnit(edges[i + 1], ind)}`,
    test: (v: number) => (i === 0 || v >= edges[i]) && (i === SEQUENTIAL.length - 1 || v < edges[i + 1]),
  }));
}

export const NO_DATA_FILL = "url(#mapa-brak-danych)";

/** Miejsce w rankingu (1 = najwyższa wartość) — opis słowny zamiast samego koloru. */
export function rank(units: MapUnit[], key: string, id: string): { place: number; of: number } | null {
  const ranked = units.filter((u) => u.values[key] != null).sort((a, b) => (b.values[key] as number) - (a.values[key] as number));
  const place = ranked.findIndex((u) => u.id === id);
  return place < 0 ? null : { place: place + 1, of: ranked.length };
}
