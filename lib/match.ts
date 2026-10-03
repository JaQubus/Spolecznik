import "server-only";
import { describeGmina, findGmina } from "./gminy";
import { rerank, type Candidate } from "./llm";
import {
  GAP_THRESHOLD, RELATED_MIN_SIMILARITY, SIMILAR_NEED_MIN_SIMILARITY,
  type InnovationMatch, type MatchResponse, type NeedCard,
} from "./schemas";
import { embedText, hybridSearch, similarNeeds, upsertIndex } from "./search";
import { newStatusCode } from "./status-code";
import { createAdminClient } from "./supabase/admin";

type MatchInput = { card: NeedCard; text: string; gmina?: string };

/**
 * Społecznik·Dopasuj (README 5.1, kroki 4–7): wyszukiwanie hybrydowe → rerank z kontekstem gminy →
 * zapis potrzeby z kodem zgłoszenia → indeksowanie potrzeby, żeby kolejne zgłoszenia ją znalazły.
 */
export async function runMatch({ card, text, gmina }: MatchInput): Promise<MatchResponse> {
  const supabase = createAdminClient();
  // Pole „Gmina” wpisane ręcznie ma pierwszeństwo przed tym, co model wyczytał z opisu.
  const [gminaRow, embedding] = await Promise.all([
    findGmina(gmina || card.gmina),
    embedText(`${card.summary}\n${card.keywords.join(", ")}`),
  ]);

  // Szukamy, zanim zapiszemy nową potrzebę — dzięki temu nie znajdzie samej siebie.
  const [innovationHits, expertHits, callHits, similar] = await Promise.all([
    hybridSearch("innowacja", card.keywords, embedding, 15),
    hybridSearch("ekspert", card.keywords, embedding, 5),
    hybridSearch("nabor", card.keywords, embedding, 5),
    similarNeeds(embedding, SIMILAR_NEED_MIN_SIMILARITY),
  ]);

  // Rerank
  const innovationIds = innovationHits.map((h) => h.ref_id);
  const { data: bodies, error: bodiesError } = await supabase
    .from("search_index")
    .select("ref_id, title, body")
    .eq("kind", "innowacja")
    .in("ref_id", innovationIds);
  if (bodiesError) throw bodiesError;
  const candidates: Candidate[] = (bodies ?? []).map((r) => ({ id: r.ref_id, title: r.title, body: r.body }));
  const ranked = await rerank(card, candidates, gminaRow ? describeGmina(gminaRow) : undefined);
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
      embedding,
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
