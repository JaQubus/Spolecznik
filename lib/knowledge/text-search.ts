// Wyszukiwanie po słowach bez kluczy API. Polska odmiana psuje dokładne dopasowanie („starszych” ≠ „starsi”),
// więc porównujemy rdzenie (początek słowa) i dokładamy kilka synonimów z języka potocznego.
// Z kluczami Zasobnik używa tej samej hybrydy co matchmaking (lib/knowledge/search.ts).

const STOPWORDS = new Set(
  "a aby albo ale ani bo by być co czy dla do i ich jak jest jego jej już lub ma mają mi mnie na nad nas nie o od oraz po pod przez przy się sobie tak też to u w we z za ze że który która które osoba osoby osób osobom ludzi ludzie".split(" "),
);

// Rdzeń → rdzenie, które też szukamy. Klucze i wartości to początki słów po normalizacji.
const SYNONYMS: Record<string, string[]> = {
  starsz: ["senior", "starsz", "podeszł", "emeryt"],
  senior: ["senior", "starsz", "podeszł"],
  wsi: ["wiejsk", "wsi", "wieś", "wiosk"],
  wieś: ["wiejsk", "wsi", "wiosk"],
  wiejsk: ["wiejsk", "wsi", "wiosk"],
  samotn: ["samotn", "osamotn", "izolacj", "relacj"],
  dziec: ["dziec", "dzieck", "młodzież", "rodzin"],
  dzieck: ["dziec", "dzieck"],
  niewidom: ["niewidom", "wzrok", "niedowid"],
  głuch: ["głuch", "niesłysz", "słuch", "pjm"],
  wózk: ["wózk", "ruch", "mobiln"],
  prac: ["prac", "zatrudn", "zawod"],
  bezdom: ["bezdom", "noclegow", "schronisk"],
  ukrain: ["ukrain", "uchodź", "cudzoziem"],
  depres: ["depres", "psychi", "emocj", "kryzys"],
  pamię: ["pamię", "demencj", "otępien", "alzheimer"],
  lek: ["lek", "lekó", "leków"],
};

export const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ");

function stem(word: string): string {
  // Krótkie słowa zostają w całości („wsi”, „lek”); dłuższe tracą końcówkę fleksyjną.
  if (word.length <= 4) return word;
  return word.slice(0, Math.max(4, Math.min(6, word.length - 2)));
}

/** Zapytanie → grupy rdzeni; każda grupa to jedno słowo z zapytania wraz z synonimami. */
export function queryStems(query: string): string[][] {
  return normalize(query)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .map((w) => {
      const s = stem(w);
      const syn = Object.entries(SYNONYMS).find(([k]) => s.startsWith(k) || k.startsWith(s));
      return [...new Set([s, ...(syn?.[1] ?? [])])];
    });
}

export type Field = { text: string | null | undefined; weight: number };

/**
 * Wynik dokumentu: dla każdego słowa zapytania najwyższa waga pola, w którym wystąpił jego rdzeń
 * (lub synonim). Rdzenie od 5 liter dopasowujemy też w środku słowa („samotn” → „osamotnione”).
 */
export function scoreDocument(groups: string[][], fields: Field[]): number {
  const words = fields.map((f) => ({ weight: f.weight, words: normalize(f.text ?? "").split(/\s+/).filter(Boolean) }));
  let score = 0;
  for (const group of groups) {
    let best = 0;
    for (const f of words) {
      const hit = f.words.some((w) => group.some((s) => (s.length >= 5 ? w.includes(s) : w.startsWith(s))));
      if (hit) best = Math.max(best, f.weight);
    }
    score += best;
  }
  return score;
}
