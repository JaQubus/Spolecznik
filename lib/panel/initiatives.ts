import "server-only";
import type { InitiativeStatus, StatusEvent } from "../initiatives/status";
import type { InitiativeCard, SubmissionKind } from "../schemas";
import { keywordSearch, similarInitiatives } from "../search";
import { createAdminClient } from "../supabase/admin";

export type InitiativeRow = {
  id: string;
  status_code: string;
  slug: string | null;
  submission_kind: SubmissionKind;
  card: InitiativeCard;
  title: string;
  summary: string;
  domains: string[];
  institution_type: string | null;
  stage: string | null;
  innovation_kind: string | null;
  sectors: string[];
  trl: number | null;
  ip_status: string | null;
  institutions: { name: string; slug: string } | null;
  status: InitiativeStatus;
  signal: number | null;
  signal_override: number | null;
  published: boolean;
  duplicate_of: string | null;
  nominations_count: number;
  raw_text: string | null;
  teryt: string | null;
  assigned_mentor: string | null;
  synthetic: boolean;
  created_at: string;
  municipalities: { name: string; county: string } | null;
};

export const INITIATIVE_COLUMNS =
  "id, status_code, slug, submission_kind, card, title, summary, domains, institution_type, stage, status, signal, signal_override, " +
  "innovation_kind, sectors, trl, ip_status, institutions(name, slug), published, duplicate_of, nominations_count, raw_text, teryt, assigned_mentor, synthetic, created_at, municipalities(name, county)";

export type CreatorRow = {
  role: string;
  display_name: string | null;
  under_18: boolean;
  guardian_consent: boolean;
  show_publicly: boolean;
};

/** Twórcy inicjatywy ze stanem zgód (tylko Panel — publicznie widok public_initiative_creators). */
export async function initiativeCreators(initiativeId: string): Promise<CreatorRow[]> {
  const { data, error } = await createAdminClient()
    .from("initiative_creators")
    .select("sort, creators(role, display_name, under_18, guardian_consent, show_publicly)")
    .eq("initiative_id", initiativeId)
    .order("sort");
  if (error) throw error;
  return (data ?? []).flatMap((r) => (r.creators ? [r.creators as unknown as CreatorRow] : []));
}

/** Skąd jest zgłoszenie — podpis w Panelu. */
export function submissionLabel(kind: SubmissionKind, long = false): string {
  if (kind === "nomination") return "wskazanie";
  if (kind === "detected") return "wykryta w źródłach";
  return long ? "zgłoszenie autora" : "zgłoszenie";
}

/** Sygnał do sortowania i pokazania: ręczna korekta z Panelu ma pierwszeństwo przed oceną radaru. */
export const effectiveSignal = (r: Pick<InitiativeRow, "signal" | "signal_override">) => r.signal_override ?? r.signal;

/** Próg duplikatu: zgodność słów kluczowych ≥ 90%. */
export const DUPLICATE_MIN = 0.9;

export type Triage = { duplicates: string[]; mentorId: string | null; mentorName: string | null };

/**
 * Możliwe duplikaty i sugerowany mentor dla listy w Panelu, ze słów kluczowych karty (bez embeddingów).
 * Liczone przy odczycie, więc obejmują też zgłoszenia, które pojawiły się później.
 */
export async function initiativeTriage(rows: Pick<InitiativeRow, "id" | "card">[]): Promise<Map<string, Triage>> {
  try {
    const entries = await Promise.all(rows.map(async (n): Promise<[string, Triage]> => {
      const keywords = n.card.keywords ?? [];
      const [dupes, mentors] = await Promise.all([
        similarInitiatives(keywords, DUPLICATE_MIN),
        keywordSearch("mentor", keywords, 1),
      ]);
      return [n.id, {
        duplicates: dupes.filter((d) => d.initiative_id !== n.id).map((d) => d.initiative_id),
        mentorId: mentors[0]?.ref_id ?? null,
        mentorName: mentors[0]?.title ?? null,
      }];
    }));
    return new Map(entries);
  } catch (e) {
    console.error("[panel] triage:", e); // bez indeksu lista działa, tylko bez podpowiedzi
    return new Map();
  }
}

export type Neighbour = { ref_id: string; title: string; body: string; teryt: string | null; similarity: number };

/** Najbliższe karty danego rodzaju dla jednej inicjatywy (szczegóły w Panelu). */
export async function initiativeNeighbours(
  initiative: { id: string; card: Pick<InitiativeCard, "keywords"> }, kind: "initiative" | "mentor" | "pattern", count = 5,
): Promise<Neighbour[]> {
  const hits = (await keywordSearch(kind, initiative.card.keywords ?? [], count + 1))
    .filter((h) => h.ref_id !== initiative.id)
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

/** Historia zmian jednej inicjatywy, od najstarszej. */
export async function initiativeHistory(id: string): Promise<AuditRow[]> {
  const { data, error } = await createAdminClient()
    .from("audit_log")
    .select("action, diff, created_at")
    .eq("entity", "initiative")
    .eq("entity_id", id)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as AuditRow[];
}

/** Zmiany statusu z historii — wspólne źródło dla Panelu i osi czasu na /status/[kod]. */
export function statusEvents(history: AuditRow[]): StatusEvent[] {
  return history
    // Wiadomość bez zmiany statusu (initiative.note) też trafia na oś czasu — przy bieżącym kroku.
    .filter((r) => (r.action === "initiative.status" || r.action === "initiative.note") && r.diff?.to)
    .map((r) => ({ to: r.diff!.to as InitiativeStatus, at: r.created_at, note: (r.diff!.note as string | null) ?? null }));
}

/** Każda zmiana w Panelu zostawia ślad w audit_log. W diff nie zapisujemy treści zgłoszeń. */
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
