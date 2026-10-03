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

/**
 * Innowacje, których nie ma w search_index (np. po seed_innovations.py albo przed embed.py), też muszą
 * trafić do reranku — inaczej każde zgłoszenie kończy się luką. Pierwsze idą te, których tytuł użytkownik
 * wpisał, potem te ze słowami kluczowymi potrzeby (rdzeń bez końcówki, jak w lib/innovations.ts); resztę oceni LLM.
 */
async function unindexedCandidates(keywords: string[], originalText: string, exclude: string[], limit: number): Promise<Candidate[]> {
  let query = createAdminClient().from("innovations").select("id, title, solution, problem, beneficiaries").limit(200);
  if (exclude.length) query = query.not("id", "in", `(${exclude.join(",")})`);
  const { data, error } = await query;
  if (error) throw error;

  const stems = keywords
    .flatMap((k) => k.toLowerCase().split(/\s+/))
    .filter((w) => w.length >= 3)
    .map((w) => (w.length > 5 ? w.slice(0, -2) : w));
  const originalLower = originalText.toLowerCase();
  return (data ?? [])
    .map((i) => {
      const body = [i.solution, i.problem && `Problem: ${i.problem}`, i.beneficiaries && `Dla kogo: ${i.beneficiaries}`]
        .filter(Boolean)
        .join("\n");
      const text = `${i.title}\n${body}`.toLowerCase();
      const named = originalLower.includes((i.title as string).toLowerCase()) ? 100 : 0;
      return { candidate: { id: i.id as string, title: i.title as string, body }, hits: named + stems.filter((s) => text.includes(s)).length };
    })
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((c) => c.candidate);
}

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

  // Rerank
  const { data: bodies, error: bodiesError } = innovationIds.length
    ? await supabase.from("search_index").select("ref_id, title, body").eq("kind", "innowacja").in("ref_id", innovationIds)
    : { data: [], error: null };
  if (bodiesError) throw bodiesError;
  const candidates: Candidate[] = (bodies ?? []).map((r) => ({ id: r.ref_id, title: r.title, body: r.body }));
  if (candidates.length < CANDIDATES) {
    candidates.push(...(await unindexedCandidates(card.keywords, original, candidates.map((c) => c.id), CANDIDATES - candidates.length)));
  }
  const ranked = await rerank(card, candidates, gminaRow ? describeGmina(gminaRow) : undefined, original);
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
