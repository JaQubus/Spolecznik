import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gminaLabel } from "../gminy";
import type { CheckedPlan, InstitutionType, PlanDocument } from "../schemas";

export type PlanRow = {
  id: string;
  innovation_id: string;
  institution_type: InstitutionType;
  created_at: string;
  innovations: { title: string; slug: string | null } | null;
  gminy: { nazwa: string; powiat: string } | null;
};

/** Plany wdrożenia z „Jak to wdrożyć u nas?”, od najnowszych (Panel → Wdrożenia). */
export async function listPlans(
  supabase: SupabaseClient,
  filter: { innovationId?: string },
  range: { from: number; to: number },
): Promise<{ rows: PlanRow[]; total: number }> {
  let query = supabase
    .from("implementation_plans")
    .select("id, innovation_id, institution_type, created_at, innovations(title, slug), gminy(nazwa, powiat)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(range.from, range.to);
  if (filter.innovationId) query = query.eq("innovation_id", filter.innovationId);
  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as PlanRow[], total: count ?? 0 };
}

export type PlannedInnovation = { id: string; title: string; plans: number; gminy: number };

/** Które innowacje gminy chcą wdrażać: liczba planów i różnych gmin na innowację, od najczęstszej. */
export async function plannedInnovations(supabase: SupabaseClient): Promise<PlannedInnovation[]> {
  const { data, error } = await supabase.from("implementation_plans").select("innovation_id, teryt, innovations(title)");
  if (error) throw error;
  const byInnovation = new Map<string, { title: string; plans: number; gminy: Set<string> }>();
  for (const row of (data ?? []) as unknown as { innovation_id: string; teryt: string; innovations: { title: string } | null }[]) {
    const entry = byInnovation.get(row.innovation_id) ?? { title: row.innovations?.title ?? "Innowacja bez nazwy", plans: 0, gminy: new Set() };
    entry.plans += 1;
    entry.gminy.add(row.teryt);
    byInnovation.set(row.innovation_id, entry);
  }
  return [...byInnovation].map(([id, e]) => ({ id, title: e.title, plans: e.plans, gminy: e.gminy.size }))
    .sort((a, b) => b.gminy - a.gminy || b.plans - a.plans || a.title.localeCompare(b.title, "pl"));
}

/** Jeden zapisany plan jako dokument do PlanDocument. */
export async function getPlan(supabase: SupabaseClient, id: string): Promise<PlanDocument | null> {
  const { data, error } = await supabase
    .from("implementation_plans")
    .select("id, created_at, input, plan, innovations(id, title), gminy(teryt, nazwa, powiat, typ)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as {
    id: string; created_at: string; input: PlanDocument["input"]; plan: CheckedPlan;
    innovations: { id: string; title: string } | null;
    gminy: { teryt: string; nazwa: string; powiat: string; typ: string | null } | null;
  };
  if (!row.innovations || !row.gminy) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    innovation: row.innovations,
    gmina: { teryt: row.gminy.teryt, nazwa: row.gminy.nazwa, label: gminaLabel(row.gminy) },
    input: row.input,
    plan: row.plan,
  };
}
