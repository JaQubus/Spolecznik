// Rdzenie słów do dopasowań bez embeddingów (Groq ich nie ma). Czysty moduł bez importów serwerowych,
// żeby testy jednostkowe (node --test --experimental-strip-types) i reguły ścieżek (lib/pathways/) ładowały go wprost.

// Słowa, które niczego nie rozróżniają (także stałe wstępy problemów z Biblioteki Innowacji Społecznych: „Innowacja odpowiada na problem…”).
const STOPWORDS = new Set([
  "który", "która", "które", "którzy", "których", "którym", "oraz", "jest", "przez", "jako", "może", "mogą", "mają",
  "bardzo", "tylko", "także", "również", "kiedy", "gdzie", "nawet", "tego", "tych", "temu", "taki", "taka", "takie",
  "jego", "sobie", "swoje", "swój", "swoją", "będzie", "było", "była", "były", "żeby", "ponieważ", "między", "przed",
  "jeszcze", "wtedy", "dlatego", "często", "bardziej", "innowacja", "innowacji", "odpowiada", "problem", "rozwiązanie",
  "dotyczy", "takich", "problemu", "problemy", "problemów", "problemowi", "problemem",
]);

/** Rdzeń bez polskiej końcówki: „seniorów” → „senio”, „przyjmowaniu” → „przyjmowa”, „leki” → „lek”. */
export function stem(word: string): string {
  if (word.length >= 7) return word.slice(0, -3);
  if (word.length >= 5) return word.slice(0, -2);
  return word.slice(0, 3);
}

export const words = (text: string) => text.toLowerCase().match(/\p{L}+/gu) ?? [];

/** Rdzenie treściowe opisu użytkownika (bez krótkich słów i słów bez znaczenia). */
export function contentStems(text: string): string[] {
  return [...new Set(words(text).filter((w) => w.length >= 4 && !STOPWORDS.has(w)).map(stem))];
}


/** Słowa treściowe (co najmniej 4 litery, bez słów bez znaczenia) w kolejności wystąpienia, bez powtórzeń. */
export function contentWords(text: string): string[] {
  return [...new Set(words(text).filter((w) => w.length >= 4 && !STOPWORDS.has(w)))];
}

/** Rdzeń do porównań słowo w słowo: co najmniej 4 litery, żeby „staż” nie łapał „stanowiska”. */
const matchKey = (w: string) => {
  const s = stem(w);
  return s.length >= 4 ? s : w.slice(0, 4);
};

/** Czy dwa słowa mają wspólny rdzeń w którąś stronę: „kompozyt” ~ „kompozytu”, „lotnictwo” ~ „lotnicze”. */
export function sameStem(a: string, b: string): boolean {
  return a.startsWith(matchKey(b)) || b.startsWith(matchKey(a));
}

/**
 * Słowa z `theirs` (w ich własnej formie, do pokazania w „dlaczego”), które mają odpowiednik w `ours`.
 * Oba argumenty to teksty albo listy słów kluczowych; liczą się tylko słowa treściowe.
 */
export function sharedWords(ours: string | string[], theirs: string | string[]): string[] {
  const a = contentWords(Array.isArray(ours) ? ours.join(" ") : ours);
  const b = contentWords(Array.isArray(theirs) ? theirs.join(" ") : theirs);
  return b.filter((w) => a.some((v) => sameStem(v, w)));
}
