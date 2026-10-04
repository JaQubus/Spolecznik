// Grupowanie podobnych potrzeb po słowach kluczowych z karty (formy podstawowe z LLM), bez embeddingów —
// Groq ich nie ma (migracja 0005). Czysta funkcja bez importów serwerowych, żeby dało się ją testować.

export type ClusterInput = { id: string; teryt: string | null; keywords: string[] };

export type KeywordCluster = {
  /** Stały klucz grupy: najczęstsze słowa, alfabetycznie, rozdzielone „|”. Pod nim trzymamy etykietę z LLM. */
  signature: string;
  /** Najczęstsze słowa w grupie, od najczęstszego, do 5. */
  keywords: string[];
  /** Zgłoszenia w grupie, pierwsze to „środek” grupy. */
  ids: string[];
  gminy: number;
};

/** Ile ważonych słów dwie karty muszą mieć wspólnych (0–1), żeby trafić do jednej grupy. Dostrojone na 200 potrzebach syntetycznych. */
export const CLUSTER_MIN_SIMILARITY = 0.3;
/** Mniejsze grupy to raczej przypadek niż trend. */
export const CLUSTER_MIN_SIZE = 3;
const MIN_SHARED = 2;
const SIGNATURE_WORDS = 4;

const norm = (k: string) => k.trim().toLowerCase();

/**
 * Grupy podobnych zgłoszeń. Podobieństwo to ważony Jaccard słów kluczowych: rzadkie słowo („udar”)
 * waży więcej niż częste („senior”), a para musi mieć co najmniej dwa wspólne słowa.
 * Grupy budujemy zachłannie: zgłoszenie z największą liczbą nieprzydzielonych sąsiadów zabiera tych
 * sąsiadów, którzy są podobni także do reszty grupy, i tak dalej. Grupa to „środek” i jego bezpośredni
 * sąsiedzi, więc nie rozlewa się łańcuchem A–B–C na niepowiązane tematy. Wynik jest deterministyczny.
 */
export function clusterNeeds(needs: ClusterInput[], minSimilarity = CLUSTER_MIN_SIMILARITY, minSize = CLUSTER_MIN_SIZE): KeywordCluster[] {
  const sets = needs.map((n) => new Set(n.keywords.map(norm).filter(Boolean)));
  const df = new Map<string, number>();
  for (const s of sets) for (const k of s) df.set(k, (df.get(k) ?? 0) + 1);
  // 1 + N/df: częste słowo waży mniej, ale nie zero — przy kilku zgłoszeniach wspólne słowa są we wszystkich.
  const idf = new Map([...df].map(([k, v]) => [k, Math.log(1 + needs.length / v)]));

  // Odwrócony indeks: porównujemy tylko pary z co najmniej jednym wspólnym słowem.
  const byWord = new Map<string, number[]>();
  sets.forEach((s, i) => {
    for (const k of s) byWord.set(k, byWord.get(k) ?? []).get(k)!.push(i);
  });

  // Sąsiedzi: indeks → podobieństwo (0–1), tylko pary powyżej progu.
  const neighbours: Map<number, number>[] = sets.map((a, i) => {
    const shared = new Map<number, number>();
    for (const k of a) for (const j of byWord.get(k)!) if (j !== i) shared.set(j, (shared.get(j) ?? 0) + 1);
    const out = new Map<number, number>();
    for (const [j, count] of shared) {
      if (count < MIN_SHARED) continue;
      const b = sets[j];
      let inter = 0, union = 0;
      for (const k of new Set([...a, ...b])) {
        union += idf.get(k)!;
        if (a.has(k) && b.has(k)) inter += idf.get(k)!;
      }
      if (union > 0 && inter / union >= minSimilarity) out.set(j, inter / union);
    }
    return out;
  });

  const free = new Set(needs.map((_, i) => i));
  const tried = new Set<number>();
  const clusters: KeywordCluster[] = [];
  for (;;) {
    let seed = -1, best = -1;
    for (const i of free) {
      if (tried.has(i)) continue;
      let n = 0;
      for (const j of neighbours[i].keys()) if (free.has(j)) n++;
      if (n > best) [seed, best] = [i, n];
    }
    if (seed < 0 || best + 1 < minSize) break;
    // Najbliżsi najpierw; kandydat wchodzi, jeśli jest podobny do co najmniej połowy grupy. Bez tego
    // zgłoszenie z pogranicza dwóch tematów („depresja” + „dojazd”) wciągnęłoby oba do jednej grupy.
    const candidates = [...neighbours[seed]].filter(([j]) => free.has(j)).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const members = [seed];
    for (const [j] of candidates) {
      const linked = members.filter((m) => neighbours[j].has(m)).length;
      if (linked * 2 >= members.length) members.push(j);
    }
    tried.add(seed);
    if (members.length < minSize) continue;
    for (const m of members) free.delete(m);

    const counts = new Map<string, number>();
    for (const m of members) for (const k of sets[m]) counts.set(k, (counts.get(k) ?? 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl")).map(([k]) => k);
    clusters.push({
      signature: top.slice(0, SIGNATURE_WORDS).sort((a, b) => a.localeCompare(b, "pl")).join("|"),
      keywords: top.slice(0, 5),
      ids: members.map((m) => needs[m].id),
      gminy: new Set(members.map((m) => needs[m].teryt).filter(Boolean)).size,
    });
  }
  return clusters;
}

/** Jaka część słów dwóch grup się pokrywa (0–1). Do ponownego użycia etykiety, gdy grupa lekko się zmieni. */
export function keywordOverlap(a: string[], b: string[]): number {
  const sa = new Set(a.map(norm));
  const sb = new Set(b.map(norm));
  const inter = [...sa].filter((k) => sb.has(k)).length;
  const union = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
}
