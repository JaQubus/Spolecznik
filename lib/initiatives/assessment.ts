import "server-only";
import { pathwaysFor, type PathwaySource, type PathwaysView } from "../pathways";
import { readAssessment, type RadarAssessment } from "../radar/score";
import { readStoredPathways } from "../schemas";
import { createAdminClient } from "../supabase/admin";
import { keyMatches } from "./access";

/**
 * Ocena radaru widziana przez autora. Ocena i uzasadnienie ścieżek liczą się po wysłaniu zgłoszenia (after() w create.ts),
 * więc ekran wyniku i strona statusu dopytują o nie, aż będą gotowe. Dostęp tylko z kluczem autora (sam kod da się zgadnąć).
 *
 * pending — model jeszcze liczy · failed — po ASSESS_TIMEOUT_MS nadal brak oceny (błąd albo limit Groq; Panel ma „Oceń ponownie”)
 * ready — ocena jest; narrativeReady mówi, czy doszło już uzasadnienie ścieżek (drugie wywołanie modelu).
 */
export type AuthorAssessment =
  | { state: "pending" }
  | { state: "failed" }
  | { state: "ready"; radar: RadarAssessment; signal: number; corrected: boolean; narrativeReady: boolean; pathways: PathwaysView | null };

/** Ile czekamy na ocenę, zanim uznamy, że się nie udała. Dwa wywołania modelu trwają zwykle 10–40 s. */
export const ASSESS_TIMEOUT_MS = 3 * 60_000;

const COLUMNS =
  "access_hash, created_at, signal, signal_override, innovation_kind, stage, trl, sectors, ip_status, institution_type, domains, teryt, adoptions_count, card, radar, pathways";

/** null = nie ma takiego zgłoszenia albo klucz się nie zgadza (dla wywołującego to to samo). */
export async function authorAssessment(
  code: string,
  key: string | null | undefined,
  { withPathways = false }: { withPathways?: boolean } = {},
): Promise<AuthorAssessment | null> {
  const { data, error } = await createAdminClient().from("initiatives").select(COLUMNS).eq("status_code", code).maybeSingle();
  if (error) throw error;
  if (!data || !keyMatches(data.access_hash as string | null, key)) return null;

  const radar = readAssessment(data.radar);
  if (!radar) {
    const age = Date.now() - new Date(data.created_at as string).getTime();
    return { state: age > ASSESS_TIMEOUT_MS ? "failed" : "pending" };
  }
  const override = data.signal_override as number | null;
  const pathways = withPathways ? await pathwaysFor(data as unknown as PathwaySource) : null;
  return {
    state: "ready",
    radar,
    signal: override ?? (data.signal as number | null) ?? radar.signal,
    corrected: override != null && override !== radar.signal,
    narrativeReady: readStoredPathways(data.pathways) != null,
    pathways,
  };
}
