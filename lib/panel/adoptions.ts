import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdoptionStatus } from "../adoption-status";
import { createAdminClient } from "../supabase/admin";

export type AdoptionRow = {
  id: string;
  initiative_id: string | null;
  pattern_id: string | null;
  tester_id: string | null;
  status: string;
  rating: number | null;
  worked: string | null;
  improve: string | null;
  adopter_org: string | null;
  planned_for: string | null;
  synthetic: boolean;
  created_at: string;
  initiatives: { title: string; slug: string | null } | null;
  patterns: { title: string; slug: string | null } | null;
  municipalities: { name: string; county: string } | null;
};

export const ADOPTION_COLUMNS =
  "id, initiative_id, pattern_id, tester_id, status, rating, worked, improve, adopter_org, planned_for, synthetic, created_at, " +
  "initiatives(title, slug), patterns(title, slug), municipalities(name, county)";

/** Tytuł i link źródła adopcji: inicjatywa z regionu albo rozwiązanie z Polski. */
export function adoptionSource(r: Pick<AdoptionRow, "initiatives" | "patterns">): { title: string; href: string | null } {
  if (r.initiatives) return { title: r.initiatives.title, href: r.initiatives.slug ? `/innowacje/${r.initiatives.slug}` : null };
  if (r.patterns) return { title: r.patterns.title, href: r.patterns.slug ? `/rozwiazania/${r.patterns.slug}` : null };
  return { title: "Pozycja usunięta", href: null };
}

/** Zgłoszenia przeniesień i oceny z /wyprobuj, od najnowszych (Panel → Adopcje). */
export async function listAdoptions(
  supabase: SupabaseClient,
  filter: { status?: AdoptionStatus; sourceId?: string },
  range: { from: number; to: number },
): Promise<{ rows: AdoptionRow[]; total: number }> {
  let query = supabase
    .from("adoptions")
    .select(ADOPTION_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(range.from, range.to);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.sourceId) query = query.or(`initiative_id.eq.${filter.sourceId},pattern_id.eq.${filter.sourceId}`);
  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as AdoptionRow[], total: count ?? 0 };
}

/** Inicjatywy i rozwiązania, które mają choć jedną adopcję — do filtra „Co przenoszą”. */
export async function adoptedSources(supabase: SupabaseClient): Promise<{ id: string; title: string }[]> {
  const { data, error } = await supabase.from("adoptions").select("initiative_id, pattern_id, initiatives(title), patterns(title)");
  if (error) throw error;
  const byId = new Map<string, string>();
  for (const r of (data ?? []) as unknown as Pick<AdoptionRow, "initiative_id" | "pattern_id" | "initiatives" | "patterns">[]) {
    const id = r.initiative_id ?? r.pattern_id;
    const title = r.initiatives?.title ?? r.patterns?.title;
    if (id && title) byId.set(id, title);
  }
  return [...byId].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title, "pl"));
}

export type AdoptionSummary = {
  total: number;
  byStatus: Record<string, number>;
  rated: number;
  avgRating: number | null;
  suggestions: { text: string; gmina: string | null; at: string }[];
};

/** Podsumowanie adopcji jednej inicjatywy albo rozwiązania (Panel: karta inicjatywy i Wiedza). */
export async function adoptionSummary(source: { initiativeId?: string; patternId?: string }, suggestionCount = 5): Promise<AdoptionSummary> {
  let query = createAdminClient()
    .from("adoptions")
    .select("status, rating, improve, created_at, municipalities(name)")
    .order("created_at", { ascending: false });
  query = source.initiativeId ? query.eq("initiative_id", source.initiativeId) : query.eq("pattern_id", source.patternId ?? "");
  const { data, error } = await query;
  if (error) throw error;
  type Row = Pick<AdoptionRow, "status" | "rating" | "improve" | "created_at"> & { municipalities: { name: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  const ratings = rows.map((r) => r.rating).filter((r): r is number => r != null);
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  return {
    total: rows.length,
    byStatus,
    rated: ratings.length,
    avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    suggestions: rows
      .filter((r) => r.improve?.trim())
      .slice(0, suggestionCount)
      .map((r) => ({ text: r.improve!.trim(), gmina: r.municipalities?.name ?? null, at: r.created_at })),
  };
}
