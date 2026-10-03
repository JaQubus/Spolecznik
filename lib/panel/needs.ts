import "server-only";
import type { NeedStatus, StatusEvent } from "../need-status";
import type { NeedCard } from "../schemas";
import { keywordSearch, similarNeeds } from "../search";
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

/** Próg duplikatu z README §6: zgodność słów kluczowych ≥ 90%. */
export const DUPLICATE_MIN = 0.9;

export type Triage = { duplicates: string[]; expertId: string | null; expertName: string | null };

/**
 * Duplikaty i sugerowany ekspert dla strony skrzynki, ze słów kluczowych karty (bez embeddingów, migracja 0005).
 * Liczone przy odczycie, więc obejmują też zgłoszenia, które pojawiły się później.
 */
export async function needTriage(needs: Pick<NeedRow, "id" | "card">[]): Promise<Map<string, Triage>> {
  try {
    const rows = await Promise.all(needs.map(async (n): Promise<[string, Triage]> => {
      const keywords = n.card.keywords ?? [];
      const [dupes, experts] = await Promise.all([
        similarNeeds(keywords, DUPLICATE_MIN),
        keywordSearch("ekspert", keywords, 1),
      ]);
      return [n.id, {
        duplicates: dupes.filter((d) => d.need_id !== n.id).map((d) => d.need_id),
        expertId: experts[0]?.ref_id ?? null,
        expertName: experts[0]?.title ?? null,
      }];
    }));
    return new Map(rows);
  } catch (e) {
    console.error("[panel] triage:", e); // bez migracji 0005 skrzynka działa, tylko bez podpowiedzi
    return new Map();
  }
}

export type Neighbour = { ref_id: string; title: string; body: string; teryt: string | null; similarity: number };

/** Najbliższe karty danego rodzaju dla jednego zgłoszenia (szczegóły w Panelu). */
export async function needNeighbours(
  need: Pick<NeedRow, "id" | "card">, kind: "potrzeba" | "ekspert", count = 5,
): Promise<Neighbour[]> {
  const hits = (await keywordSearch(kind, need.card.keywords ?? [], count + 1))
    .filter((h) => h.ref_id !== need.id)
    .slice(0, count);
  if (hits.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("search_index")
    .select("ref_id, body")
    .eq("kind", kind)
    .in("ref_id", hits.map((h) => h.ref_id));
  if (error) throw error;
  const bodyById = new Map((data ?? []).map((r) => [r.ref_id as string, r.body as string]));
  return hits.map((h) => ({ ref_id: h.ref_id, title: h.title, body: bodyById.get(h.ref_id) ?? "", teryt: h.teryt, similarity: h.similarity }));
}

export type AuditRow = { action: string; diff: Record<string, unknown> | null; created_at: string };

/** Historia zmian jednego zgłoszenia (albo pomysłu), od najstarszej. */
export async function needHistory(id: string, entity: "need" | "idea" = "need"): Promise<AuditRow[]> {
  const { data, error } = await createAdminClient()
    .from("audit_log")
    .select("action, diff, created_at")
    .eq("entity", entity)
    .eq("entity_id", id)
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
  actorId: string | null, // null: konto testowe (lib/auth.ts) nie ma użytkownika w auth.users
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
