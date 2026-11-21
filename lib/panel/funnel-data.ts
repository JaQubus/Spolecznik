import "server-only";
import { createAdminClient } from "../supabase/admin";
import type { PanelScope } from "./scope";
import type { FunnelItem } from "./funnel-board";

type Row = {
  id: string; status_code: string; title: string; funnel_stage: string | null; signal: number | null; signal_override: number | null;
  updated_at: string; institutions: { name: string } | null; partners?: { name: string } | null;
};

const COLUMNS = "id, status_code, title, funnel_stage, signal, signal_override, updated_at, institutions(name)";

/** Innowacje do widoku lejka (bez duplikatów), w zakresie z Panelu. */
export async function loadFunnelItems(scope: PanelScope): Promise<FunnelItem[]> {
  const supabase = createAdminClient();
  const build = (columns: string) => {
    const scoped = supabase.from("initiatives").select(columns);
    return (scope.kind === "all" ? scoped : scoped.eq("institution_id", scope.institutionId))
      .is("duplicate_of", null).order("updated_at", { ascending: false }).limit(3000);
  };
  let res = await build(`${COLUMNS}, partners:assigned_partner(name)`);
  // Baza sprzed 0010 nie ma assigned_partner, sprzed 0009 funnel_stage: lejek działa wtedy bez partnera.
  if (res.error) res = await build(COLUMNS.replace("funnel_stage, ", ""));
  if (res.error) throw res.error;
  return (res.data as unknown as Row[]).map((r) => ({
    id: r.id, status_code: r.status_code, title: r.title, funnel_stage: r.funnel_stage ?? null, signal: r.signal_override ?? r.signal,
    institution_name: r.institutions?.name ?? null, partner_name: r.partners?.name ?? null, updated_at: r.updated_at,
  }));
}

export type FunnelEvent = { id: number; initiative_id: string; stage: string; source: string; note: string | null; created_at: string };

/** Ostatnie przejścia w lejku dla podanych innowacji. */
export async function recentFunnelEvents(initiativeIds: string[], limit = 12): Promise<FunnelEvent[]> {
  if (initiativeIds.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("funnel_events").select("id, initiative_id, stage, source, note, created_at")
    .in("initiative_id", initiativeIds.slice(0, 500)).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as FunnelEvent[];
}
