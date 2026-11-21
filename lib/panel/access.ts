import "server-only";
import { forbidden, redirect } from "next/navigation";
import { getViewer, type Viewer } from "../auth";
import { createAdminClient } from "../supabase/admin";
import { canSee, scopeFor, type PanelScope } from "./scope";

export { canSee };
export type { PanelScope };

/** Instytucja opiekuna: konto Supabase ma ją w profilu, konto testowe TEST_INSTITUTION_ID albo pierwszą alfabetycznie. */
async function institutionOf(viewer: Viewer): Promise<string | null> {
  if (viewer.role !== "institution") return null;
  if (viewer.via === "supabase") return viewer.institutionId;
  if (process.env.TEST_INSTITUTION_ID) return process.env.TEST_INSTITUTION_ID;
  const { data, error } = await createAdminClient().from("institutions").select("id").order("name").limit(1).maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

/**
 * Wpuszcza zespół PCI i opiekunów instytucji. Niezalogowany → logowanie, inna rola (albo opiekun bez instytucji) → 403.
 * Strona i akcja, która zmienia dane albo pokazuje cokolwiek poza własną instytucją, woła requireAdmin (lib/auth.ts);
 * tu wchodzi tylko to, co da się zawęzić do `scope`. Konto Supabase czyta dodatkowo przez RLS (0010), konto testowe
 * ma service role — granicę trzyma wtedy `scope` w zapytaniu.
 */
/** Zakres bez przekierowań, dla route handlerów (eksport CSV): null = brak dostępu, odpowiedź 403 daje wywołujący. */
export async function staffScope(): Promise<PanelScope | null> {
  const viewer = await getViewer();
  return viewer ? scopeFor(viewer.role, await institutionOf(viewer)) : null;
}

export async function requireStaff(nextPath = "/panel"): Promise<{ viewer: Viewer; scope: PanelScope }> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/logowanie?next=${encodeURIComponent(nextPath)}`);
  const scope = scopeFor(viewer.role, await institutionOf(viewer));
  if (!scope) forbidden();
  return { viewer, scope };
}

/** Zawęża zapytanie do instytucji opiekuna (administrator: bez zmian). */
export function applyScope<Q extends { eq: (column: string, value: string) => Q }>(query: Q, scope: PanelScope): Q {
  return scope.kind === "all" ? query : query.eq("institution_id", scope.institutionId);
}
