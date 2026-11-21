import "server-only";
import { createAdminClient } from "../supabase/admin";
import type { MetricContact, MetricInitiative } from "./metrics";

export type MetricsInput = { initiatives: MetricInitiative[]; contacts: MetricContact[]; counties: { id: string; name: string }[] };

/** Dane do wskaźników: wszystkie innowacje, prośby o kontakt i powiaty regionu (z tabeli municipalities). */
export async function loadMetricsInput(): Promise<MetricsInput> {
  const supabase = createAdminClient();
  const [initiatives, contacts, municipalities] = await Promise.all([
    supabase.from("initiatives").select("id, created_at, status, funnel_stage, submission_kind, teryt, sectors, duplicate_of").limit(10000),
    supabase.from("contact_requests").select("initiative_id, created_at, updated_at, status").limit(10000),
    supabase.from("municipalities").select("teryt, county").limit(1000),
  ]);
  if (initiatives.error) throw initiatives.error;
  if (contacts.error) throw contacts.error;
  if (municipalities.error) throw municipalities.error;
  const counties = new Map<string, string>();
  for (const m of municipalities.data ?? []) counties.set((m.teryt as string).slice(0, 4), m.county as string);
  return {
    initiatives: (initiatives.data ?? []) as MetricInitiative[],
    contacts: (contacts.data ?? []) as MetricContact[],
    counties: [...counties].map(([id, name]) => ({ id, name })),
  };
}
