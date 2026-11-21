import "server-only";
import type { DomainKey } from "./taxonomy";
import { createClient } from "./supabase/server";

/** Sprawdzone rozwiązanie z Polski (Biblioteka Innowacji Społecznych Regionalnego Ośrodka Polityki Społecznej w Krakowie, ze źródłem). */
export type PatternListItem = {
  id: string;
  slug: string | null;
  title: string;
  category: string | null;
  domains: string[];
  solution: string | null;
  etr_summary: string | null;
  video_url: string | null;
  adoptions_count: number;
  avg_rating: number | null;
  synthetic: boolean;
};

export type Pattern = PatternListItem & {
  cross_topics: string[];
  institution_types: string[];
  problem: string | null;
  beneficiaries: string | null;
  who_can_use: string | null;
  evidence: string | null;
  how_to_use: string | null;
  components: string | null;
  source_url: string | null;
  source_name: string | null;
  license_url: string | null;
  pdf_url: string | null;
};

/** Ile rozwiązań pokazujemy naraz; resztę zawęża się filtrem albo wyszukiwarką. */
export const LIST_LIMIT = 200;

const LIST_COLUMNS = "id, slug, title, category, domains, solution, etr_summary, video_url, adoptions_count, avg_rating, synthetic";

/** Znaki, które w filtrze PostgREST (`or=(…)`) mają znaczenie składniowe albo są wieloznacznikami. */
const sanitizeFilter = (q: string) => q.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);

/** Słowa zapytania jako wzorce ILIKE, bez końcówki, żeby „seniorów” trafiało w „senior”. */
export const filterWords = (q?: string) =>
  (q ? sanitizeFilter(q) : "").split(" ").filter((w) => w.length >= 3).slice(0, 6).map((w) => `*${w.length > 5 ? w.slice(0, -2) : w}*`);

export async function listPatterns({ domain, q }: { domain?: DomainKey; q?: string }) {
  const supabase = await createClient();
  let query = supabase.from("patterns").select(LIST_COLUMNS, { count: "exact" }).order("title").limit(LIST_LIMIT);
  if (domain) query = query.contains("domains", [domain]);
  // Każde słowo musi wystąpić w którejś kolumnie. Proste dopasowanie tekstu; wyszukiwanie po lematach jest w „Szukam rozwiązania”.
  for (const p of filterWords(q)) {
    query = query.or(`title.ilike.${p},solution.ilike.${p},problem.ilike.${p},beneficiaries.ilike.${p},etr_summary.ilike.${p}`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  return { items: data as PatternListItem[], total: count ?? data.length };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Po slugu, a dla rozwiązania bez sluga po id (listy linkują wtedy /rozwiazania/<id>). */
export async function getPattern(slugOrId: string): Promise<Pattern | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patterns")
    .select("*")
    .eq(UUID.test(slugOrId) ? "id" : "slug", slugOrId)
    .maybeSingle();
  if (error) throw error;
  return data as Pattern | null;
}

/** Rozwiązania pasujące do dziedziny albo tematu przekrojowego (strony dziedzin w /wiedza). */
export async function patternsMatching({ domains = [], cross = [] }: { domains?: string[]; cross?: string[] }, limit = 3) {
  const supabase = await createClient();
  const filters: string[] = [];
  if (domains.length) filters.push(`domains.ov.{${domains.join(",")}}`);
  if (cross.length) filters.push(`cross_topics.ov.{${cross.join(",")}}`);
  if (!filters.length) return [];
  const { data, error } = await supabase
    .from("patterns")
    .select(LIST_COLUMNS)
    .or(filters.join(","))
    .order("adoptions_count", { ascending: false })
    .order("title")
    .limit(limit);
  if (error) throw error;
  return data as PatternListItem[];
}

export type SourceOption = { id: string; title: string; slug: string | null; kind: "initiative" | "pattern" };

/** Do list wyboru w „Przenieś do siebie” i „Wypróbowaliśmy u nas”: opublikowane inicjatywy i rozwiązania. */
export async function sourceOptions(): Promise<SourceOption[]> {
  const supabase = await createClient();
  const [initiatives, patterns] = await Promise.all([
    supabase.from("public_initiatives").select("id, title, slug").order("title"),
    supabase.from("patterns").select("id, title, slug").order("title"),
  ]);
  if (initiatives.error) throw initiatives.error;
  if (patterns.error) throw patterns.error;
  return [
    ...(initiatives.data ?? []).map((i) => ({ id: i.id as string, title: i.title as string, slug: i.slug as string | null, kind: "initiative" as const })),
    ...(patterns.data ?? []).map((p) => ({ id: p.id as string, title: p.title as string, slug: p.slug as string | null, kind: "pattern" as const })),
  ];
}

/**
 * ?inicjatywa= albo ?rozwiazanie= z karty: slug (czytelny adres) albo id. Zwraca wybraną pozycję, a dla nieznanej
 * wartości null — formularz otwiera się wtedy bez wyboru.
 */
export function pickSource(
  params: { inicjatywa?: string | string[]; rozwiazanie?: string | string[] },
  options: SourceOption[],
): SourceOption | null {
  const value = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
  const find = (kind: SourceOption["kind"], v: string) =>
    v ? options.find((o) => o.kind === kind && (o.id === v || o.slug === v)) ?? null : null;
  return find("initiative", value(params.inicjatywa)) ?? find("pattern", value(params.rozwiazanie));
}
