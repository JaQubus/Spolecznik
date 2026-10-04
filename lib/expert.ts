import "server-only";
import { forbidden, redirect } from "next/navigation";
import { getViewer, type Viewer } from "./auth";
import { expertRole } from "./notification-types";
import { notify } from "./notifications";
import { createAdminClient } from "./supabase/admin";
import { isSupabaseConfigured } from "./supabase/server";
import { expertName, type NeedThread } from "./threads";

export type Expert = { id: string; name: string };

/**
 * Ekspert, jako który działa ta osoba. Konto Supabase z rolą „ekspert” = jego profil (ten sam id co w indeksie
 * ekspertów, lib/index-card.ts). Konto testowe = TEST_EXPERT_ID albo pierwszy alfabetycznie ekspert z indeksu,
 * żeby w demo dało się przypisać go w Panelu i odpowiedzieć z /ekspert.
 */
export async function currentExpert(viewer: Viewer | null): Promise<Expert | null> {
  if (viewer?.role !== "ekspert" || !isSupabaseConfigured()) return null;
  if (viewer.via === "supabase" && viewer.id) return { id: viewer.id, name: (await expertName(viewer.id)) ?? viewer.label };
  const query = createAdminClient().from("search_index").select("ref_id, title").eq("kind", "ekspert");
  const { data, error } = await (process.env.TEST_EXPERT_ID
    ? query.eq("ref_id", process.env.TEST_EXPERT_ID)
    : query.order("title").limit(1)
  ).maybeSingle();
  if (error) throw error;
  return data ? { id: data.ref_id as string, name: data.title as string } : null;
}

/**
 * Wpuszcza tylko eksperta: niezalogowany → logowanie, inna rola → 403. Jak requireAdmin — woła to każda strona
 * i akcja /ekspert, bo akcje serwerowe są publicznymi endpointami. `expert` = null: konto eksperta bez rekordu
 * w indeksie (np. baza bez danych demo) — strona pokazuje wtedy wyjaśnienie zamiast listy.
 */
export async function requireExpert(nextPath = "/ekspert"): Promise<{ viewer: Viewer; expert: Expert | null }> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/logowanie?next=${encodeURIComponent(nextPath)}`);
  if (viewer.role !== "ekspert") forbidden();
  return { viewer, expert: await currentExpert(viewer) };
}

/** Zgłoszenie albo pomysł jest przypisany do tego eksperta (needs.assigned_expert albo threads.expert_id). */
export const isAssigned = (t: NeedThread | null, expert: Expert | null): t is NeedThread =>
  !!t && !!expert && t.expert?.id === expert.id;

export type AssignedReport = {
  kind: "potrzeba" | "pomysl";
  code: string;
  status: string;
  summary: string;
  gmina: string | null;
  updatedAt: string;
};

/** Lista „moje zgłoszenia” eksperta. Bez raw_text: tylko zanonimizowana karta potrzeby i krótki opis pomysłu. */
export async function assignedReports(expertId: string): Promise<AssignedReport[]> {
  const db = createAdminClient();
  const [needs, threads] = await Promise.all([
    db.from("needs").select("status_code, status, card, updated_at, gminy(nazwa)").eq("assigned_expert", expertId),
    db.from("threads").select("entity_id").eq("entity_kind", "pomysl").eq("expert_id", expertId),
  ]);
  if (needs.error) throw needs.error;
  if (threads.error) throw threads.error;
  const ideaIds = (threads.data ?? []).map((t) => t.entity_id as string);
  const ideas = ideaIds.length
    ? await db.from("ideas").select("status_code, status, fiszka, created_at").in("id", ideaIds)
    : { data: [], error: null };
  if (ideas.error) throw ideas.error;

  return [
    ...(needs.data ?? []).map((n) => ({
      kind: "potrzeba" as const,
      code: n.status_code as string,
      status: n.status as string,
      summary: ((n.card as { summary?: string } | null)?.summary ?? "").trim(),
      gmina: (n.gminy as unknown as { nazwa: string } | null)?.nazwa ?? null,
      updatedAt: n.updated_at as string,
    })),
    ...(ideas.data ?? []).map((i) => ({
      kind: "pomysl" as const,
      code: i.status_code as string,
      status: i.status as string,
      summary: ((i.fiszka as { krotki_opis?: string } | null)?.krotki_opis ?? "").trim(),
      gmina: null,
      updatedAt: i.created_at as string,
    })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Przypisanie w Panelu → powiadomienie eksperta (#63). Ekspert z kontem dostaje je po user_id; ekspert bez konta
 * (dane demo, konto testowe) po kluczu roli „ekspert:<id>”, bo notifications.user_id wskazuje na auth.users.
 */
export async function notifyExpert(expertId: string, t: Pick<NeedThread, "kind" | "id" | "code">): Promise<void> {
  try {
    const { data } = await createAdminClient().from("profiles").select("id").eq("id", expertId).eq("role", "ekspert").maybeSingle();
    const target = data ? { user_id: expertId } : { role: expertRole(expertId) };
    await notify({ ...target, kind: "prosba_eksperta", payload: { kind: t.kind, id: t.id, code: t.code } });
  } catch (e) {
    console.error("[ekspert] powiadomienie o przypisaniu:", e);
  }
}
