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
