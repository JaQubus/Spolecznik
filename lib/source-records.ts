// Sprawdzanie dublowania bez LLM i bez embeddingów (Radar 7/10). Czyste funkcje: bez „server-only” i z rozszerzeniami
// .ts w importach, żeby testy jednostkowe czytały plik wprost. Te same reguły ma data/sources/sources_seed.py.

/** Słowa kluczowe do porównań: małe litery, bez pustych i powtórzeń. */
export function normalizeKeywords(words: readonly string[]): string[] {
  return [...new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean))];
}

// Słowa, które pojawiają się przy każdym rozwiązaniu technicznym i niczego nie rozróżniają.
const GENERIC = new Set([
  "metoda", "sposób", "system", "technologia", "rozwiązanie", "materiał", "produkcja", "patent", "projekt", "zastosowanie",
  "urządzenie", "układ", "method", "system", "technology", "device",
]);

/** Rdzeń bez polskiej końcówki — jak stem() w lib/matching.ts: „kompozytu” → „kompoz”, „upadków” → „upad”. */
function stem(word: string): string {
  if (word.length >= 7) return word.slice(0, -3);
  if (word.length >= 5) return word.slice(0, -2);
  return word;
}

/** Rdzenie treściowe z listy słów kluczowych (frazy dzielimy na słowa, „wykrywanie_upadków” też). */
export function keywordStems(words: readonly string[]): string[] {
  const all = normalizeKeywords(words).flatMap((k) => k.match(/\p{L}+/gu) ?? []);
  return [...new Set(all.filter((w) => w.length >= 4 && !GENERIC.has(w)).map(stem))];
}

/** Rdzenie pasują, gdy są równe albo krótszy (min. 4 znaki) jest początkiem dłuższego: „monitor” ~ „monitorowa”. */
const stemsMatch = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/**
 * Podobieństwo dwóch list słów kluczowych (0–1): część rdzeni krótszej listy, które mają parę w dłuższej
 * (współczynnik nakładania). Odporne na różne formy i długości list z LLM.
 */
export function keywordSimilarity(a: readonly string[], b: readonly string[]): number {
  const sa = keywordStems(a);
  const sb = keywordStems(b);
  if (sa.length === 0 || sb.length === 0) return 0;
  const [short, long] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
  return short.filter((s) => long.some((l) => stemsMatch(s, l))).length / short.length;
}

/** Próg, od którego dwa rekordy ze źródeł uznajemy za to samo rozwiązanie (np. zgłoszenie PL i jego odpowiednik EP). */
export const SAME_SOLUTION_MIN_SIMILARITY = 0.6;
/** Krótsza lista musi mieć co najmniej tyle rdzeni — inaczej jedno wspólne słowo dawałoby 100%. */
export const SAME_SOLUTION_MIN_STEMS = 4;

export type DuplicateCandidate = { initiativeId: string; keywords: readonly string[] };

/** Czy nowy kandydat to duplikat już wykrytej inicjatywy: najbardziej podobna, o ile ≥ progu. */
export function pickDuplicate(keywords: readonly string[], existing: readonly DuplicateCandidate[], min = SAME_SOLUTION_MIN_SIMILARITY): string | null {
  if (keywordStems(keywords).length < SAME_SOLUTION_MIN_STEMS) return null;
  let best: { id: string; score: number } | null = null;
  for (const e of existing) {
    if (keywordStems(e.keywords).length < SAME_SOLUTION_MIN_STEMS) continue;
    const score = keywordSimilarity(keywords, e.keywords);
    if (score >= min && (!best || score > best.score)) best = { id: e.initiativeId, score };
  }
  return best?.id ?? null;
}
