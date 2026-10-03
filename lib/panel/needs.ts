import "server-only";
import type { NeedStatus, StatusEvent } from "../need-status";
import type { NeedCard } from "../schemas";
import { createAdminClient } from "../supabase/admin";

export type NeedRow = {
  id: string;
  status_code: string;
  card: NeedCard;
  status: NeedStatus;
  best_fit: number | null;
  raw_text: string | null;
  teryt: string | null;
  assigned_expert: string | null;
  synthetic: boolean;
  created_at: string;
  gminy: { nazwa: string; powiat: string } | null;
};

export const NEED_COLUMNS =
  "id, status_code, card, status, best_fit, raw_text, teryt, assigned_expert, synthetic, created_at, gminy(nazwa, powiat)";

export type Triage = { duplicates: string[]; expertId: string | null; expertName: string | null };

/** Duplikaty (podobieństwo ≥ 0,9) i sugerowany ekspert dla strony skrzynki — jedno zapytanie na stronę. */
export async function needTriage(needIds: string[]): Promise<Map<string, Triage>> {
  if (needIds.length === 0) return new Map();
  const { data, error } = await createAdminClient().rpc("need_triage", { p_need_ids: needIds });
  if (error) throw error;
  return new Map(
    (data ?? []).map((r: { need_id: string; duplicates: string[]; expert_id: string | null; expert_name: string | null }) => [
      r.need_id,
      { duplicates: r.duplicates ?? [], expertId: r.expert_id, expertName: r.expert_name },
    ]),
  );
}

export type Neighbour = { ref_id: string; title: string; body: string; teryt: string | null; similarity: number };

export async function needNeighbours(needId: string, kind: "potrzeba" | "ekspert", count = 5): Promise<Neighbour[]> {
  const { data, error } = await createAdminClient().rpc("need_neighbours", { p_need_id: needId, p_kind: kind, p_count: count });
  if (error) throw error;
  return (data ?? []) as Neighbour[];
}

export type AuditRow = { action: string; diff: Record<string, unknown> | null; created_at: string };

/** Historia zmian jednego zgłoszenia, od najstarszej. */
export async function needHistory(needId: string): Promise<AuditRow[]> {
  const { data, error } = await createAdminClient()
    .from("audit_log")
    .select("action, diff, created_at")
    .eq("entity", "need")
    .eq("entity_id", needId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as AuditRow[];
}

/** Zmiany statusu z historii — wspólne źródło dla Panelu i osi czasu na /status/[kod]. */
export function statusEvents(history: AuditRow[]): StatusEvent[] {
  return history
    .filter((r) => r.diff?.to)
    .map((r) => ({ to: r.diff!.to as NeedStatus, at: r.created_at, note: (r.diff!.note as string | null) ?? null }));
}

/** Każda zmiana w Panelu zostawia ślad (README §7: audit_log). W diff nie zapisujemy treści zgłoszeń. */
export async function logChange(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  diff: Record<string, unknown>,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("audit_log")
    .insert({ actor_id: actorId, action, entity, entity_id: entityId, diff });
  if (error) throw error;
}
