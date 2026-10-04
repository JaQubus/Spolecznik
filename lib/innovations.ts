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

/** Ile innowacji pokazujemy naraz; resztę zawęża się filtrem albo wyszukiwarką. */
export const LIST_LIMIT = 200;

const LIST_COLUMNS = "id, slug, title, category, target_groups, solution, etr_summary, video_url, tests_count, avg_rating, synthetic";

/** Znaki, które w filtrze PostgREST (`or=(…)`) mają znaczenie składniowe albo są wieloznacznikami. */
const sanitize = (q: string) => q.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);

export async function listInnovations({ group, q }: { group?: (typeof GROUPS)[number]; q?: string }) {
  const supabase = await createClient();
  let query = supabase.from("innovations").select(LIST_COLUMNS, { count: "exact" }).order("title").limit(LIST_LIMIT);
  if (group) query = query.contains("target_groups", [group]);
  // Każde słowo (bez końcówki, żeby „seniorów” trafiało w „senior”) musi wystąpić w którejś kolumnie.
  // To proste dopasowanie tekstu; wyszukiwanie semantyczne (lib/search.ts) jest w „Opisz problem”.
  const words = (q ? sanitize(q) : "").split(" ").filter((w) => w.length >= 3).slice(0, 6);
  for (const w of words) {
    const p = `*${w.length > 5 ? w.slice(0, -2) : w}*`;
    query = query.or(`title.ilike.${p},solution.ilike.${p},problem.ilike.${p},beneficiaries.ilike.${p},etr_summary.ilike.${p}`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  return { items: data as InnovationListItem[], total: count ?? data.length };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Po slugu, a dla innowacji bez sluga po id (listy linkują wtedy /biblioteka/<id>). */
export async function getInnovation(slugOrId: string): Promise<Innovation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("innovations")
    .select("*")
    .eq(UUID.test(slugOrId) ? "id" : "slug", slugOrId)
    .maybeSingle();
  if (error) throw error;
  return data as Innovation | null;
}

/** Innowacje dla obszaru Mapy Wyzwań: po obszarze (enrich.py) albo po pasujących grupach docelowych. */
export async function innovationsForArea(area: (typeof MWS_AREAS)[number], groups: string[], limit = 3) {
  return innovationsMatching({ area, groups }, limit);
}

/** Innowacje pasujące do któregokolwiek kryterium: obszar, grupa docelowa albo temat przekrojowy. */
export async function innovationsMatching(
  { area, groups = [], cross = [] }: { area?: (typeof MWS_AREAS)[number]; groups?: string[]; cross?: string[] },
  limit = 3,
) {
  const supabase = await createClient();
  const filters: string[] = [];
  if (area) filters.push(`areas.cs.{${area}}`);
  if (groups.length) filters.push(`target_groups.ov.{${groups.join(",")}}`);
  if (cross.length) filters.push(`cross_topics.ov.{${cross.join(",")}}`);
  if (!filters.length) return [];
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

export type InnovationOption = { id: string; title: string; slug: string | null };

/** Tytuły innowacji do list wyboru (Wdrożenie, Próba). */
export async function innovationOptions(): Promise<InnovationOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("innovations").select("id, title, slug").order("title");
  if (error) throw error;
  return data ?? [];
}

/**
 * ?innowacja= z karty innowacji: slug (czytelny adres) albo id. Zwraca id z listy wyboru,
 * a dla nieznanej wartości pusty napis — formularz otwiera się wtedy bez wybranej innowacji.
 */
export function pickInnovation(param: string | string[] | undefined, options: InnovationOption[]): string {
  const value = typeof param === "string" ? param.trim() : "";
  if (!value) return "";
  return options.find((o) => o.id === value || o.slug === value)?.id ?? "";
}
