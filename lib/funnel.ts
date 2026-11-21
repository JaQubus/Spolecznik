import "server-only";
import { createAdminClient } from "./supabase/admin";

/** Zapis przejścia w lejku (advance_funnel, 0009). Błąd tylko logujemy — lejek nie może zablokować akcji użytkownika. */
export async function advanceFunnel(
  initiativeId: string, stage: string, source: "system" | "author" | "panel", opts: { refId?: string; note?: string; actorId?: string | null } = {},
): Promise<void> {
  const { error } = await createAdminClient().rpc("advance_funnel", {
    p_initiative: initiativeId, p_stage: stage, p_source: source, p_ref: opts.refId ?? null, p_note: opts.note ?? null, p_actor: opts.actorId ?? null,
  });
  if (error) console.error("[lejek]", error);
}

/**
 * Przesunięcie w lejku z Panelu (9/10). W odróżnieniu od advanceFunnel zwraca wynik i błąd rzuca: zespół ma zobaczyć,
 * że przejście się nie zapisało. `changed` = false, gdy innowacja jest już na tym etapie albo dalej (zdarzenie i tak trafia do historii).
 */
export async function moveFunnel(initiativeId: string, stage: string, actorId: string | null, note?: string): Promise<{ changed: boolean }> {
  const { data, error } = await createAdminClient().rpc("advance_funnel", {
    p_initiative: initiativeId, p_stage: stage, p_source: "panel", p_ref: null, p_note: note ?? null, p_actor: actorId,
  });
  if (error) throw error;
  return { changed: data === true };
}
