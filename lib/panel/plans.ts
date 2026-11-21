import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gminaLabel } from "../gminy";
import type { CheckedPlan, PlanDocument, SourceKind } from "../schemas";

export type PlanRow = {
  id: string;
  source_kind: SourceKind;
  source_id: string;
  institution_type: string;
  created_at: string;
  municipalities: { name: string; county: string } | null;
};

const sourceHref = (kind: SourceKind, slug: string | null, id: string) =>
  kind === "initiative" ? (slug ? `/inicjatywy/${slug}` : `/panel/inicjatywy/${id}`) : `/rozwiazania/${slug ?? id}`;

/** Tytuły i linki źródeł planów (inicjatywa albo rozwiązanie) — źródło to para kind + id bez klucza obcego. */
export async function sourceTitles(
  supabase: SupabaseClient,
  rows: Pick<PlanRow, "source_kind" | "source_id">[],
): Promise<Map<string, { title: string; href: string }>> {
  const ids = (kind: SourceKind) => [...new Set(rows.filter((r) => r.source_kind === kind).map((r) => r.source_id))];
  const [initiatives, patterns] = await Promise.all([
    ids("initiative").length ? supabase.from("initiatives").select("id, title, slug").in("id", ids("initiative")) : { data: [], error: null },
    ids("pattern").length ? supabase.from("patterns").select("id, title, slug").in("id", ids("pattern")) : { data: [], error: null },
  ]);
  if (initiatives.error) throw initiatives.error;
  if (patterns.error) throw patterns.error;
  return new Map([
    ...(initiatives.data ?? []).map((r) => [r.id as string, { title: r.title as string, href: sourceHref("initiative", r.slug as string | null, r.id as string) }] as const),
    ...(patterns.data ?? []).map((r) => [r.id as string, { title: r.title as string, href: sourceHref("pattern", r.slug as string | null, r.id as string) }] as const),
  ]);
}

/** Plany przeniesienia z „Przenieś do siebie”, od najnowszych (Panel → Przeniesienia). */
export async function listPlans(
  supabase: SupabaseClient,
  filter: { sourceId?: string },
  range: { from: number; to: number },
): Promise<{ rows: PlanRow[]; total: number }> {
  let query = supabase
    .from("transfer_plans")
    .select("id, source_kind, source_id, institution_type, created_at, municipalities(name, county)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(range.from, range.to);
  if (filter.sourceId) query = query.eq("source_id", filter.sourceId);
  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as PlanRow[], total: count ?? 0 };
}

export type PlannedSource = { id: string; kind: SourceKind; title: string; plans: number; gminy: number };

/** Co gminy chcą przenosić: liczba planów i różnych gmin na źródło, od najczęstszego. */
export async function plannedSources(supabase: SupabaseClient): Promise<PlannedSource[]> {
  const { data, error } = await supabase.from("transfer_plans").select("source_kind, source_id, teryt");
  if (error) throw error;
  const rows = (data ?? []) as { source_kind: SourceKind; source_id: string; teryt: string }[];
  const titles = await sourceTitles(supabase, rows);
  const bySource = new Map<string, { kind: SourceKind; plans: number; gminy: Set<string> }>();
  for (const row of rows) {
    const entry = bySource.get(row.source_id) ?? { kind: row.source_kind, plans: 0, gminy: new Set() };
    entry.plans += 1;
    entry.gminy.add(row.teryt);
    bySource.set(row.source_id, entry);
  }
  return [...bySource]
    .map(([id, e]) => ({ id, kind: e.kind, title: titles.get(id)?.title ?? "Pozycja usunięta", plans: e.plans, gminy: e.gminy.size }))
    .sort((a, b) => b.gminy - a.gminy || b.plans - a.plans || a.title.localeCompare(b.title, "pl"));
}

/** Jeden zapisany plan jako dokument do PlanDocument. */
export async function getPlan(supabase: SupabaseClient, id: string): Promise<PlanDocument | null> {
  const { data, error } = await supabase
    .from("transfer_plans")
    .select("id, created_at, source_kind, source_id, input, plan, municipalities(teryt, name, county, kind)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as {
    id: string; created_at: string; source_kind: SourceKind; source_id: string; input: PlanDocument["input"]; plan: CheckedPlan;
    municipalities: { teryt: string; name: string; county: string; kind: string | null } | null;
  };
  const source = (await sourceTitles(supabase, [row])).get(row.source_id);
  if (!source || !row.municipalities) return null;
  const m = row.municipalities;
  return {
    id: row.id,
    createdAt: row.created_at,
    source: { kind: row.source_kind, id: row.source_id, ...source },
    gmina: { teryt: m.teryt, nazwa: m.name, label: gminaLabel({ nazwa: m.name, powiat: m.county, typ: m.kind }) },
    input: row.input,
    plan: row.plan,
  };
}
