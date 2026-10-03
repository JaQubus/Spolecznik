import "server-only";
import { describeGmina, findGmina } from "./gminy";
import { rerank, type Candidate } from "./llm";
import { anonymize } from "./pii";
import {
  GAP_THRESHOLD, RELATED_MIN_SIMILARITY, SIMILAR_NEED_MIN_SIMILARITY,
  type InnovationMatch, type MatchResponse, type NeedCard,
} from "./schemas";
import { keywordSearch, similarNeeds, upsertIndex } from "./search";
import { newStatusCode } from "./status-code";
import { createAdminClient } from "./supabase/admin";

type MatchInput = { card: NeedCard; text: string; gmina?: string; teryt?: string };

const CANDIDATES = 15;
/** Od tej części słów opisu znalezionych w tekście innowacji kandydat zawsze trafia do reranku. */
const STRONG_OVERLAP = 0.6;
/** Opis prawie dosłownie powtarza tekst innowacji — wtedy nie może skończyć się luką. */
const VERBATIM_OVERLAP = 0.85;
const VERBATIM_MIN_WORDS = 4;

// Słowa, które niczego nie rozróżniają (także stały wstęp opisów z Biblioteki: „Innowacja odpowiada na problem”).
const STOPWORDS = new Set([
  "który", "która", "które", "którzy", "których", "którym", "oraz", "jest", "przez", "jako", "może", "mogą", "mają",
  "bardzo", "tylko", "także", "również", "kiedy", "gdzie", "nawet", "tego", "tych", "temu", "taki", "taka", "takie",
  "jego", "sobie", "swoje", "swój", "swoją", "będzie", "było", "była", "były", "żeby", "ponieważ", "między", "przed",
  "jeszcze", "wtedy", "dlatego", "często", "bardziej", "innowacja", "innowacji", "odpowiada", "problem", "rozwiązanie",
]);

/** Rdzeń bez polskiej końcówki: „seniorów” → „senio”, „przyjmowaniu” → „przyjmowa”, „leki” → „lek”. */
function stem(word: string): string {
  if (word.length >= 7) return word.slice(0, -3);
  if (word.length >= 5) return word.slice(0, -2);
  return word.slice(0, 3);
}

const words = (text: string) => text.toLowerCase().match(/\p{L}+/gu) ?? [];

/** Rdzenie treściowe opisu użytkownika (bez krótkich słów i słów bez znaczenia). */
function contentStems(text: string): string[] {
  return [...new Set(words(text).filter((w) => w.length >= 4 && !STOPWORDS.has(w)).map(stem))];
}

type Lexical = { candidate: Candidate; overlap: number; named: boolean; score: number };

/**
 * Dopasowanie po słowach w całej tabeli innowacji — niezależne od search_index i od tego, jak model streścił opis.
 * Łapie opisy wklejone albo przepisane z Biblioteki (słowo w słowo), które karta potrzeby gubi.
 *
 * Każde słowo waży tyle, ile jest rzadkie w Bibliotece (IDF): „osoba” czy „wszystkie” są prawie wszędzie i nic nie
 * mówią, „leki” czy „zapomina” — dużo. overlap = ważona część słów z opisu użytkownika obecnych w tekście innowacji
 * (0–1); opis wklejony słowo w słowo daje ~1. Słowa kluczowe z karty (formy podstawowe z LLM) liczymy tak samo —
 * to one łapią parafrazy („zapomina o lekach” → „lek”, „pamięć”).
 */
async function lexicalCandidates(originalText: string, keywords: string[]): Promise<Lexical[]> {
  const { data, error } = await createAdminClient()
    .from("innovations")
    .select("id, title, solution, problem, beneficiaries, etr_summary")
    .limit(500);
  if (error) throw error;

  const docs = (data ?? []).map((i) => {
    const body = [i.solution, i.problem && `Problem: ${i.problem}`, i.beneficiaries && `Dla kogo: ${i.beneficiaries}`]
      .filter(Boolean)
      .join("\n");
    const tokens = [...new Set(words(`${i.title} ${body} ${i.etr_summary ?? ""}`))];
    return { id: i.id as string, title: i.title as string, body, has: (s: string) => tokens.some((t) => t.startsWith(s)) };
  });

  const userStems = contentStems(originalText);
  const keywordStems = [...new Set(keywords.flatMap(words).filter((w) => w.length >= 4).map(stem))];
  const idf = new Map(
    [...new Set([...userStems, ...keywordStems])].map((s) => {
      const df = docs.filter((d) => d.has(s)).length;
      return [s, Math.log((docs.length + 1) / (df + 1))];
    }),
  );
  const weighted = (stems: string[], has: (s: string) => boolean) => {
    const total = stems.reduce((sum, s) => sum + (idf.get(s) ?? 0), 0);
    return total > 0 ? stems.filter(has).reduce((sum, s) => sum + (idf.get(s) ?? 0), 0) / total : 0;
  };
  const originalLower = originalText.toLowerCase();

  return docs
    .map((d) => {
      const overlap = weighted(userStems, d.has);
      const named = originalLower.includes(d.title.toLowerCase());
      const score = (named ? 100 : 0) + overlap * 10 + weighted(keywordStems, d.has) * 6;
      return { candidate: { id: d.id, title: d.title, body: d.body, overlap }, overlap, named, score };
    })
    .sort((a, b) => b.score - a.score);
}

/** Użytkownik wskazał innowację wprost: wpisał jej tytuł albo prawie dosłownie powtórzył jej opis. */
const pointsAt = (l: Lexical, wordCount: number) => l.named || (l.overlap >= VERBATIM_OVERLAP && wordCount >= VERBATIM_MIN_WORDS);

/**
 * Społecznik·Dopasuj (README 5.1, kroki 4–7): wyszukiwanie po lematach → rerank z kontekstem gminy →
 * zapis potrzeby z kodem zgłoszenia → indeksowanie potrzeby, żeby kolejne zgłoszenia ją znalazły.
 */
export async function runMatch({ card, text, gmina, teryt }: MatchInput): Promise<MatchResponse> {
  const supabase = createAdminClient();
  // Oryginalne słowa (np. wklejony tytuł innowacji) trafiają do reranku, ale tylko po anonimizacji.
  const original = anonymize(text).text;

  // Szukamy, zanim zapiszemy nową potrzebę — dzięki temu nie znajdzie samej siebie.
  // Pole „Gmina” ma pierwszeństwo przed tym, co model wyczytał z opisu; gdy go nie znamy (literówka, wieś), bierzemy gminę z opisu.
  const [gminaRow, innovationHits, expertHits, callHits, similar] = await Promise.all([
    findGmina(gmina, teryt).then((g) => g ?? findGmina(card.gmina)),
    keywordSearch("innowacja", card.keywords, CANDIDATES),
    keywordSearch("ekspert", card.keywords, 5),
    keywordSearch("nabor", card.keywords, 5),
    similarNeeds(card.keywords, SIMILAR_NEED_MIN_SIMILARITY),
  ]);

  // Bez embeddingów słowa kluczowe mogą się minąć z opisem innowacji („samotność” vs „izolacja”),
  // więc listę dla reranku dopełniamy innowacjami z tych samych obszarów — znaczenie oceni LLM.
  const innovationIds = innovationHits.map((h) => h.ref_id);
  if (innovationIds.length < CANDIDATES) {
    let fill = supabase
      .from("search_index")
      .select("ref_id")
      .eq("kind", "innowacja")
      .eq("active", true)
      .overlaps("areas", [...card.areas])
      .limit(CANDIDATES - innovationIds.length);
    if (innovationIds.length) fill = fill.not("ref_id", "in", `(${innovationIds.join(",")})`);
    const { data: extra, error: fillError } = await fill;
    if (fillError) throw fillError;
    innovationIds.push(...(extra ?? []).map((r) => r.ref_id as string));
  }

  // Kandydaci do reranku: najpierw mocne dopasowania po słowach użytkownika (opis wklejony z Biblioteki nie może
  // wypaść przez to, że indeks zwrócił 15 innych), potem trafienia z indeksu, na końcu reszta po słowach.
  const [{ data: bodies, error: bodiesError }, lexical] = await Promise.all([
    innovationIds.length
      ? supabase.from("search_index").select("ref_id, title, body").eq("kind", "innowacja").in("ref_id", innovationIds)
      : Promise.resolve({ data: [], error: null }),
    lexicalCandidates(original, card.keywords),
  ]);
  if (bodiesError) throw bodiesError;
  const overlapById = new Map(lexical.map((l) => [l.candidate.id, l.overlap]));
  const candidates: Candidate[] = [];
  const add = (c: Candidate) => {
    if (candidates.length < CANDIDATES && !candidates.some((x) => x.id === c.id)) candidates.push(c);
  };
  lexical.filter((l) => l.named || l.overlap >= STRONG_OVERLAP).forEach((l) => add(l.candidate));
  (bodies ?? []).forEach((r) => add({ id: r.ref_id, title: r.title, body: r.body, overlap: overlapById.get(r.ref_id) }));
  lexical.forEach((l) => add(l.candidate));

  const ranked = await rerank(card, candidates, gminaRow ? describeGmina(gminaRow) : undefined, original);

  // Siatka bezpieczeństwa: innowacja wskazana wprost (tytuł albo opis słowo w słowo) zostaje w wynikach,
  // nawet gdy model, sugerując się streszczeniem, ocenił ją nisko.
  const wordCount = contentStems(original).length;
  for (const l of lexical.filter((x) => pointsAt(x, wordCount) && candidates.some((c) => c.id === x.candidate.id))) {
    const r = ranked.find((x) => x.id === l.candidate.id);
    if (r && r.fit >= 80) continue;
    const pinned = {
      id: l.candidate.id,
      fit: 85,
      why: l.named ? "Wpisany tytuł to nazwa tego rozwiązania." : "Twój opis prawie dosłownie powtarza opis tego rozwiązania.",
      adapt: r?.adapt || "Porównaj opis rozwiązania z sytuacją w Twojej gminie i sprawdź, czego potrzeba do wdrożenia.",
    };
    if (r) Object.assign(r, pinned);
    else ranked.push(pinned);
  }
  ranked.sort((a, b) => b.fit - a.fit);
  const isGap = (ranked[0]?.fit ?? 0) < GAP_THRESHOLD;

  // Zapis potrzeby z kodem zgłoszenia (ponowienie przy kolizji kodu)
  let need: { id: string; status_code: string } | null = null;
  for (let attempt = 0; attempt < 3 && !need; attempt++) {
    const { data, error } = await supabase
      .from("needs")
      .insert({
        status_code: newStatusCode(),
        raw_text: text,
        card,
        teryt: gminaRow?.teryt ?? null,
        status: isGap ? "luka" : "zgloszone",
        best_fit: ranked[0]?.fit ?? null,
      })
      .select("id, status_code")
      .single();
    if (error && error.code !== "23505") throw error;
    need = data;
  }
  if (!need) throw new Error("Nie udało się nadać kodu zgłoszenia");

  // Wszystkie oceny zapisujemy (analityka), użytkownikowi pokazujemy tylko te powyżej progu.
  const { data: matchRows, error: matchError } = ranked.length
    ? await supabase
        .from("matches")
        .insert(ranked.map((m) => ({ need_id: need.id, kind: "innowacja", ref_id: m.id, fit: m.fit, why: m.why, adapt: m.adapt })))
        .select("id, ref_id")
    : { data: [], error: null };
  if (matchError) throw matchError;
  const matchIdByRef = new Map((matchRows ?? []).map((r) => [r.ref_id as string, r.id as string]));

  // Indeks i powiadomienie nie mogą zablokować wyniku dla użytkownika.
  const sideEffects = await Promise.allSettled([
    upsertIndex({
      kind: "potrzeba",
      refId: need.id,
      title: card.summary.slice(0, 140),
      body: card.summary,
      lemmas: card.keywords,
      areas: [...card.areas],
      targetGroups: [...card.groups],
      teryt: gminaRow?.teryt ?? null,
    }),
    supabase.from("notifications").insert({
      role: "admin",
      kind: "nowa_potrzeba",
      payload: { needId: need.id, statusCode: need.status_code, summary: card.summary, isGap },
    }).then(({ error }) => { if (error) throw error; }),
  ]);
  for (const r of sideEffects) if (r.status === "rejected") console.error("[match] efekt uboczny:", r.reason);

  const shown = ranked.filter((m) => m.fit >= GAP_THRESHOLD);
  const relatedExperts = expertHits.filter((h) => h.similarity >= RELATED_MIN_SIMILARITY);
  const relatedCalls = callHits.filter((h) => h.similarity >= RELATED_MIN_SIMILARITY);

  const [innovations, experts, calls] = await Promise.all([
    shown.length
      ? supabase.from("innovations")
          .select("id, title, slug, category, etr_summary, tests_count, avg_rating")
          .in("id", shown.map((m) => m.id))
      : { data: [], error: null },
    relatedExperts.length
      ? supabase.from("search_index").select("ref_id, title, body")
          .eq("kind", "ekspert").in("ref_id", relatedExperts.map((h) => h.ref_id))
      : { data: [], error: null },
    relatedCalls.length
      ? supabase.from("calls").select("id, title, closes_at")
          .eq("active", true).in("id", relatedCalls.map((h) => h.ref_id))
      : { data: [], error: null },
  ]);
  for (const r of [innovations, experts, calls]) if (r.error) throw r.error;

  const innovationById = new Map((innovations.data ?? []).map((i) => [i.id as string, i]));
  const matches: InnovationMatch[] = shown.flatMap((m) => {
    const i = innovationById.get(m.id);
    const matchId = matchIdByRef.get(m.id);
    if (!i || !matchId) return [];
    return [{
      ...m,
      matchId,
      title: i.title,
      slug: i.slug,
      category: i.category,
      etrSummary: i.etr_summary,
      testsCount: i.tests_count ?? 0,
      avgRating: i.avg_rating != null ? Number(i.avg_rating) : null,
    }];
  });

  // „4 inne gminy zgłosiły podobny problem” — liczymy gminy, nie zgłoszenia, i bez własnej.
  const otherGminy = new Map<string, string>();
  for (const s of similar) {
    if (s.teryt && s.teryt !== gminaRow?.teryt) otherGminy.set(s.teryt, s.gmina ?? s.teryt);
  }

  return {
    need: { id: need.id, statusCode: need.status_code, gmina: gminaRow?.nazwa ?? null },
    matches,
    isGap,
    similarNeeds: { count: otherGminy.size, gminy: [...otherGminy.values()] },
    experts: (experts.data ?? []).map((e) => ({ id: e.ref_id, name: e.title, description: e.body })),
    calls: (calls.data ?? []).map((c) => ({ id: c.id, title: c.title, closesAt: c.closes_at })),
  };
}
