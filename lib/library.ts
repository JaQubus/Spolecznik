import "server-only";
import { GROUPS } from "./schemas";
import { createAdminClient } from "./supabase/admin";

export type Group = (typeof GROUPS)[number];
export const isGroup = (v: unknown): v is Group => typeof v === "string" && (GROUPS as readonly string[]).includes(v);

export type InnovationTile = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  etrSummary: string | null;
  solution: string | null;
  testsCount: number;
  avgRating: number | null;
  synthetic: boolean;
};

/** Innowacje do Biblioteki, opcjonalnie tylko dla jednej grupy „dla kogo”. */
export async function listInnovations(group?: Group): Promise<InnovationTile[]> {
  let query = createAdminClient()
    .from("innovations")
    .select("id, slug, title, category, etr_summary, solution, tests_count, avg_rating, synthetic")
    .not("slug", "is", null)
    .order("title");
  if (group) query = query.contains("target_groups", [group]);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.id,
    slug: i.slug,
    title: i.title,
    category: i.category,
    etrSummary: i.etr_summary,
    solution: i.solution,
    testsCount: i.tests_count ?? 0,
    avgRating: i.avg_rating != null ? Number(i.avg_rating) : null,
    synthetic: i.synthetic,
  }));
}

export type Innovation = InnovationTile & {
  problem: string | null;
  evidence: string | null;
  howToUse: string | null;
  components: string | null;
  beneficiaries: string | null;
  whoCanUse: string | null;
  sourceUrl: string | null;
  pdfUrl: string | null;
  videoUrl: string | null;
  areas: string[];
  targetGroups: string[];
};

export async function getInnovation(slug: string): Promise<Innovation | null> {
  const { data: i, error } = await createAdminClient()
    .from("innovations")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!i) return null;
  return {
    id: i.id,
    slug: i.slug,
    title: i.title,
    category: i.category,
    etrSummary: i.etr_summary,
    solution: i.solution,
    testsCount: i.tests_count ?? 0,
    avgRating: i.avg_rating != null ? Number(i.avg_rating) : null,
    synthetic: i.synthetic,
    problem: i.problem,
    evidence: i.evidence,
    howToUse: i.how_to_use,
    components: i.components,
    beneficiaries: i.beneficiaries,
    whoCanUse: i.who_can_use,
    sourceUrl: i.source_url,
    pdfUrl: i.pdf_url,
    videoUrl: i.video_url,
    areas: i.areas ?? [],
    targetGroups: i.target_groups ?? [],
  };
}

/** Tytuły innowacji do list wyboru (Wdrożenie, Próba). */
export async function innovationOptions(): Promise<{ id: string; title: string }[]> {
  const { data, error } = await createAdminClient().from("innovations").select("id, title").order("title");
  if (error) throw error;
  return data ?? [];
}

export async function innovationById(id: string): Promise<{ id: string; title: string; slug: string | null } | null> {
  const { data, error } = await createAdminClient().from("innovations").select("id, title, slug").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
