import "server-only";
import type { InitiativeCard } from "../schemas";
import { createPublicClient, publicClientConfigured } from "../supabase/public";
import type { DomainKey, InnovationKindKey, InstitutionKey, SectorKey, StageKey } from "../taxonomy";

/**
 * Opublikowane inicjatywy dla stron publicznych — wyłącznie z widoku public_initiatives (0007_innovation_model.sql),
 * kluczem anon: bez danych kontaktowych, surowego tekstu i pól roboczych karty.
 */
export type PublicInitiative = {
  id: string;
  slug: string | null;
  title: string;
  summary: string;
  domains: string[];
  institution_type: string | null;
  stage: string | null;
  cross_topics: string[];
  innovation_kind: string | null;
  sectors: string[];
  trl: number | null;
  ip_status: string | null;
  institution_name: string | null;
  teryt: string | null;
  county_teryt: string | null;
  municipality: string | null;
  county: string | null;
  card: Partial<InitiativeCard>;
  radar: unknown;
  signal: number | null;
  status: string;
  nominations_count: number;
  adoptions_count: number;
  avg_rating: number | null;
  synthetic: boolean;
  created_at: string;
};

const LIST = "id, slug, title, summary, domains, institution_type, stage, cross_topics, innovation_kind, sectors, trl, ip_status, institution_name, teryt, county_teryt, municipality, county, signal, status, nominations_count, adoptions_count, avg_rating, synthetic, created_at";

export type InitiativeFilter = {
  domain?: DomainKey; institution?: InstitutionKey; stage?: StageKey; kind?: InnovationKindKey; sector?: SectorKey; county?: string; q?: string;
};

export const publicInitiativesAvailable = publicClientConfigured;

export async function listPublicInitiatives(f: InitiativeFilter = {}, limit = 500): Promise<PublicInitiative[]> {
  let query = createPublicClient()
    .from("public_initiatives")
    .select(LIST)
    .order("signal", { ascending: false, nullsFirst: false })
    .order("title")
    .limit(limit);
  if (f.domain) query = query.contains("domains", [f.domain]);
  if (f.institution) query = query.eq("institution_type", f.institution);
  if (f.stage) query = query.eq("stage", f.stage);
  if (f.kind) query = query.eq("innovation_kind", f.kind);
  if (f.sector) query = query.contains("sectors", [f.sector]);
  if (f.county) query = query.eq("county_teryt", f.county);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as PublicInitiative[]).map((r) => ({ ...r, avg_rating: r.avg_rating == null ? null : Number(r.avg_rating) }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPublicInitiative(slugOrId: string): Promise<PublicInitiative | null> {
  const { data, error } = await createPublicClient()
    .from("public_initiatives")
    .select(`${LIST}, card, radar`)
    .eq(UUID.test(slugOrId) ? "id" : "slug", slugOrId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as PublicInitiative;
  return { ...row, card: row.card ?? {}, avg_rating: row.avg_rating == null ? null : Number(row.avg_rating) };
}

/** Twórca na stronie publicznej: rola zawsze, podpis tylko za zgodą (widok public_initiative_creators, 0007). */
export type PublicCreator = { role: string; display_name: string | null };

export async function getPublicCreators(initiativeId: string): Promise<PublicCreator[]> {
  const { data, error } = await createPublicClient()
    .from("public_initiative_creators")
    .select("role, display_name")
    .eq("initiative_id", initiativeId)
    .order("sort");
  if (error) throw error;
  return (data ?? []) as PublicCreator[];
}
