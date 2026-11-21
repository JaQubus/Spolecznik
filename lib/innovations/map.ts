// Mapa innowacji: liczba opublikowanych innowacji w powiecie i klasa koloru. Czyste funkcje.

export const countByCounty = (items: readonly { county_teryt: string | null }[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const i of items) if (i.county_teryt) out[i.county_teryt] = (out[i.county_teryt] ?? 0) + 1;
  return out;
};

/** Klasa 0–4: 0 = brak, potem 1, 2, 3–4, 5 i więcej. */
export const countClass = (n: number): 0 | 1 | 2 | 3 | 4 => (n <= 0 ? 0 : n <= 2 ? (n as 1 | 2) : n <= 4 ? 3 : 4);

/** Kolory klas z tokenów mapy (app/globals.css, --map-red-*). Klasa 0 = brak innowacji, bez koloru. */
export const COUNT_FILLS: Record<0 | 1 | 2 | 3 | 4, string | null> = {
  0: null, 1: "var(--map-red-2)", 2: "var(--map-red-3)", 3: "var(--map-red-4)", 4: "var(--map-red-5)",
};

export const COUNT_LEGEND = [
  { c: 0, text: "brak innowacji" },
  { c: 1, text: "1 innowacja" },
  { c: 2, text: "2 innowacje" },
  { c: 3, text: "3–4 innowacje" },
  { c: 4, text: "5 i więcej" },
] as const;
