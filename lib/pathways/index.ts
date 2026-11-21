import "server-only";
import { pathwayNarrative, models } from "../llm";
import { assessInitiative } from "../radar";
import { radarCardInput } from "../radar/score";
import { createAdminClient } from "../supabase/admin";
import type { StoredPathways } from "../schemas";
import { partnerKindLabel, RADAR_KEYS } from "../taxonomy";
import type { ChallengeCandidate, PartnerCandidate } from "./match";
import { buildPathwaysView, type MatchCandidates, type PathwaySource, type PathwaysView } from "./view";

export * from "./view";

/**
 * Kandydaci do dopasowania: aktywni partnerzy ze słowami kluczowymi z search_index i wyzwania z „Szukam rozwiązania”.
 * Kilkadziesiąt do kilkuset wierszy — liczymy w kodzie, bez osobnej funkcji w bazie, żeby reguły były w jednym miejscu.
 * Wyzwania mają tylko streszczenie (zanonimizowane przy zapisie), typ instytucji i powiat — bez gminy i kontaktu.
 */
export async function loadMatchCandidates(): Promise<MatchCandidates> {
  const supabase = createAdminClient();
  const [partners, lemmas, challenges] = await Promise.all([
    supabase.from("partners").select("id, slug, name, kind, description, sectors, domains, support, trl_min, trl_max, stages, teryt, synthetic").eq("active", true),
    supabase.from("search_index").select("ref_id, lemmas").eq("kind", "partner"),
    supabase.from("challenges").select("id, card, institution_type, synthetic, municipalities(county)").order("created_at", { ascending: false }).limit(500),
  ]);
  if (partners.error) throw partners.error;
  if (lemmas.error) throw lemmas.error;
  if (challenges.error) throw challenges.error;
  const lemmasOf = new Map((lemmas.data ?? []).map((l) => [l.ref_id as string, String(l.lemmas ?? "").split(/\s+/).filter(Boolean)]));
  return {
    partners: (partners.data ?? []).map((p) => ({ ...(p as Omit<PartnerCandidate, "keywords">), keywords: lemmasOf.get(p.id as string) ?? [] })),
    challenges: (challenges.data ?? []).flatMap((c): ChallengeCandidate[] => {
      const card = (c.card ?? {}) as { summary?: string; keywords?: string[]; domains?: string[] };
      if (!card.summary) return [];
      const county = (c.municipalities as unknown as { county: string } | null)?.county ?? null;
      return [{
        id: c.id as string, summary: card.summary, keywords: card.keywords ?? [], domains: card.domains ?? [],
        institutionType: (c.institution_type as string | null) ?? null, county: county ? county.replace(/^m\. /, "") : null,
        synthetic: c.synthetic as boolean,
      }];
    }),
  };
}

/** Ścieżki, partnerzy i wyzwania dla jednej innowacji. */
export async function pathwaysFor(src: PathwaySource): Promise<PathwaysView> {
  return buildPathwaysView(src, await loadMatchCandidates());
}

const SOURCE_COLUMNS = "innovation_kind, stage, trl, sectors, ip_status, institution_type, domains, teryt, adoptions_count, card, radar, pathways";

export async function initiativePathwaySource(initiativeId: string): Promise<PathwaySource | null> {
  const { data, error } = await createAdminClient().from("initiatives").select(SOURCE_COLUMNS).eq("id", initiativeId).maybeSingle();
  if (error) throw error;
  return (data as unknown as PathwaySource | null) ?? null;
}

/**
 * Uzasadnienie, kolejne kroki i dodatkowe mierniki dla ścieżek z reguł (jedno wywołanie modelu) → initiatives.pathways.
 * Wołane po ocenie radaru (after() w lib/initiatives/create.ts, „Oceń ponownie”) i przyciskiem w Panelu.
 */
export async function generatePathwayNarrative(initiativeId: string): Promise<StoredPathways> {
  const src = await initiativePathwaySource(initiativeId);
  if (!src) throw new Error(`Nie ma inicjatywy ${initiativeId}`);
  const view = await pathwaysFor(src);
  const card = (src.card ?? {}) as Record<string, unknown>;
  const dims = (src.radar as { dimensions?: Record<string, { score: number }> } | null)?.dimensions;
  const narrative = await pathwayNarrative({
    card: radarCardInput(card, src),
    radar: dims ? Object.fromEntries(RADAR_KEYS.filter((k) => dims[k]).map((k) => [k, dims[k].score])) : null,
    pathways: view.recommendation.pathways.map((p) => ({ key: p.key, label: p.label, variant: p.variantLabel, reasons: p.reasons, metrics: p.metrics })),
    partners: view.partners.slice(0, 6).map((m) => ({ name: m.partner.name, kind: partnerKindLabel(m.partner.kind) })),
  });
  const stored: StoredPathways = {
    items: narrative.pathways,
    keys: view.recommendation.pathways.map((p) => p.key),
    model: models.quality,
    generatedAt: new Date().toISOString(),
  };
  const { error } = await createAdminClient().from("initiatives").update({ pathways: stored }).eq("id", initiativeId);
  if (error) throw error;
  return stored;
}

/** Ocena radaru, a po niej uzasadnienie ścieżek: dwa wywołania modelu jedno po drugim (wspólny limit tokenów na minutę). */
export async function assessAndExplain(initiativeId: string): Promise<void> {
  await assessInitiative(initiativeId);
  await generatePathwayNarrative(initiativeId);
}
