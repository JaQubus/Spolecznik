import "server-only";
import { describeGmina, findGmina } from "./gminy";
import { lexicalCandidates, matchDetails, rankCandidates, relatedSupport } from "./matching";
import { notify } from "./notifications";
import { anonymize } from "./pii";
import { GAP_THRESHOLD, type ChallengeCard, type ChallengeResponse } from "./schemas";
import { upsertIndex } from "./search";
import { createAdminClient } from "./supabase/admin";

type ChallengeInput = { card: ChallengeCard; text: string; gmina?: string; teryt?: string };

/**
 * „Szukam rozwiązania”: instytucja opisuje problem i dostaje inicjatywy z regionu oraz sprawdzone rozwiązania
 * z Polski, które odpowiadają na ten sam problem. Wyzwanie zapisujemy (bez kodu i rozmowy) — zasila mapę
 * „popyt bez podaży” w Panelu, gdy nic nie pasuje (is_gap).
 */
export async function searchChallenge({ card, text, gmina, teryt }: ChallengeInput): Promise<ChallengeResponse> {
  const supabase = createAdminClient();
  // Oryginalne słowa trafiają do reranku, ale tylko po anonimizacji.
  const original = anonymize(text).text;

  // Pole „Gmina” ma pierwszeństwo przed tym, co model wyczytał z opisu.
  const [gminaRow, lexical, support] = await Promise.all([
    findGmina(gmina, teryt).then((g) => g ?? findGmina(card.municipality)),
    lexicalCandidates(original, card.keywords, ["initiative", "pattern"]),
    relatedSupport(card.keywords),
  ]);
  const kindOf = new Map(lexical.map((l) => [l.candidate.id, l.kind]));
  const ranked = await rankCandidates(card, lexical, original, gminaRow ? describeGmina(gminaRow) : undefined);
  const isGap = (ranked[0]?.fit ?? 0) < GAP_THRESHOLD;

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({
      card,
      raw_text: text,
      teryt: gminaRow?.teryt ?? null,
      institution_type: card.institutionType,
      best_fit: ranked[0]?.fit ?? null,
      is_gap: isGap,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Wszystkie oceny zapisujemy (analityka), użytkownikowi pokazujemy tylko te powyżej progu.
  const { data: matchRows, error: matchError } = ranked.length
    ? await supabase
        .from("matches")
        .insert(ranked.map((m) => ({
          challenge_id: challenge.id, target_kind: kindOf.get(m.id) ?? "pattern", target_id: m.id, fit: m.fit, why: m.why, adapt: m.adapt,
        })))
        .select("id, target_id")
    : { data: [], error: null };
  if (matchError) throw matchError;
  const matchIds = new Map((matchRows ?? []).map((r) => [r.target_id as string, r.id as string]));

  // Indeks i powiadomienie nie mogą zablokować wyniku dla użytkownika.
  const sideEffects = await Promise.allSettled([
    upsertIndex({
      kind: "challenge",
      refId: challenge.id,
      title: card.summary.slice(0, 140),
      body: card.summary,
      lemmas: card.keywords,
      domains: [...card.domains],
      institutionType: card.institutionType,
      teryt: gminaRow?.teryt ?? null,
    }),
    isGap
      ? notify({ role: "admin", kind: "wyzwanie_bez_rozwiazania", payload: { challengeId: challenge.id, summary: card.summary } })
      : Promise.resolve(),
  ]);
  for (const r of sideEffects) if (r.status === "rejected") console.error("[szukam] efekt uboczny:", r.reason);

  return {
    challengeId: challenge.id,
    matches: await matchDetails(ranked.filter((m) => m.fit >= GAP_THRESHOLD), kindOf, matchIds),
    isGap,
    ...support,
  };
}
