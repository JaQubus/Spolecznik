import "server-only";
import type { GROUPS, MWS_AREAS } from "./schemas";
import { createClient } from "./supabase/server";

export type InnovationListItem = {
  id: string;
  slug: string | null;
  title: string;
  category: string | null;
  target_groups: string[];
  solution: string | null;
  etr_summary: string | null;
  video_url: string | null;
  tests_count: number;
  avg_rating: number | null;
  synthetic: boolean;
};

export type Innovation = InnovationListItem & {
  areas: string[];
  problem: string | null;
  beneficiaries: string | null;
  who_can_use: string | null;
  evidence: string | null;
  how_to_use: string | null;
  components: string | null;
  source_url: string | null;
  pdf_url: string | null;
};

const LIST_COLUMNS = "id, slug, title, category, target_groups, solution, etr_summary, video_url, tests_count, avg_rating, synthetic";

/** Znaki, które w filtrze PostgREST (`or=(…)`) mają znaczenie składniowe albo są wieloznacznikami. */
const sanitize = (q: string) => q.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);

export async function listInnovations({ group, q }: { group?: (typeof GROUPS)[number]; q?: string }) {
  const supabase = await createClient();
  let query = supabase.from("innovations").select(LIST_COLUMNS).order("title");
  if (group) query = query.contains("target_groups", [group]);
  const text = q ? sanitize(q) : "";
  if (text) {
    const p = `*${text}*`;
    query = query.or(`title.ilike.${p},solution.ilike.${p},problem.ilike.${p},etr_summary.ilike.${p}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as InnovationListItem[];
}

export async function getInnovation(slug: string): Promise<Innovation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("innovations").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as Innovation | null;
}

/** Innowacje dla obszaru Mapy Wyzwań: po obszarze (enrich.py) albo po pasujących grupach docelowych. */
export async function innovationsForArea(area: (typeof MWS_AREAS)[number], groups: string[], limit = 3) {
  const supabase = await createClient();
  const filters = [`areas.cs.{${area}}`];
  if (groups.length) filters.push(`target_groups.ov.{${groups.join(",")}}`);
  const { data, error } = await supabase
    .from("innovations")
    .select(LIST_COLUMNS)
    .or(filters.join(","))
    .order("tests_count", { ascending: false })
    .order("title")
    .limit(limit);
  if (error) throw error;
  return data as InnovationListItem[];
}
