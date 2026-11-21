import "server-only";
import { forbidden, redirect } from "next/navigation";
import { getViewer, type Viewer } from "./auth";
import { mentorRole } from "./notification-types";
import { notify } from "./notifications";
import { createAdminClient } from "./supabase/admin";
import { isSupabaseConfigured } from "./supabase/server";
import type { InitiativeThread } from "./threads";

export type Mentor = { id: string; name: string };

/**
 * Mentor, jako który działa ta osoba. Konto Supabase z rolą „mentor” = wiersz mentors z tym profile_id.
 * Konto testowe = TEST_MENTOR_ID albo pierwszy alfabetycznie aktywny mentor, żeby w demo dało się przypisać go
 * w Panelu i odpowiedzieć z /mentor.
 */
export async function currentMentor(viewer: Viewer | null): Promise<Mentor | null> {
  if (viewer?.role !== "mentor" || !isSupabaseConfigured()) return null;
  const query = createAdminClient().from("mentors").select("id, name").eq("active", true);
  const { data, error } = await (viewer.via === "supabase" && viewer.id
    ? query.eq("profile_id", viewer.id)
    : process.env.TEST_MENTOR_ID
      ? query.eq("id", process.env.TEST_MENTOR_ID)
      : query.order("name").limit(1)
  ).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id as string, name: data.name as string } : null;
}

/**
 * Wpuszcza tylko mentora: niezalogowany → logowanie, inna rola → 403. Jak requireAdmin — woła to każda strona
 * i akcja /mentor, bo akcje serwerowe są publicznymi endpointami. `mentor` = null: konto mentora bez wiersza
 * w tabeli mentors (np. baza bez danych demo) — strona pokazuje wtedy wyjaśnienie zamiast listy.
 */
export async function requireMentor(nextPath = "/mentor"): Promise<{ viewer: Viewer; mentor: Mentor | null }> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/logowanie?next=${encodeURIComponent(nextPath)}`);
  if (viewer.role !== "mentor") forbidden();
  return { viewer, mentor: await currentMentor(viewer) };
}

/** Inicjatywa jest przypisana do tego mentora (initiatives.assigned_mentor albo threads.mentor_id). */
export const isAssigned = (t: InitiativeThread | null, mentor: Mentor | null): t is InitiativeThread =>
  !!t && !!mentor && t.mentor?.id === mentor.id;

export type AssignedInitiative = {
  code: string;
  status: string;
  title: string;
  summary: string;
  gmina: string | null;
  updatedAt: string;
};

/** Lista „moje inicjatywy” mentora. Bez raw_text: tylko zanonimizowany tytuł i streszczenie karty. */
export async function assignedInitiatives(mentorId: string): Promise<AssignedInitiative[]> {
  const db = createAdminClient();
  const threads = await db.from("threads").select("entity_id").eq("entity_kind", "initiative").eq("mentor_id", mentorId);
  if (threads.error) throw threads.error;
  const threadIds = (threads.data ?? []).map((t) => t.entity_id as string);
  const filter = [`assigned_mentor.eq.${mentorId}`, ...(threadIds.length ? [`id.in.(${threadIds.join(",")})`] : [])].join(",");
  const { data, error } = await db
    .from("initiatives")
    .select("status_code, status, title, summary, updated_at, municipalities(name)")
    .or(filter)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((i) => ({
    code: i.status_code as string,
    status: i.status as string,
    title: i.title as string,
    summary: (i.summary as string).trim(),
    gmina: (i.municipalities as unknown as { name: string } | null)?.name ?? null,
    updatedAt: i.updated_at as string,
  }));
}

/**
 * Przypisanie w Panelu → powiadomienie mentora. Mentor z kontem dostaje je po user_id; mentor bez konta
 * (dane demo, konto testowe) po kluczu roli „mentor:<id>”, bo notifications.user_id wskazuje na auth.users.
 */
export async function notifyMentor(mentorId: string, t: Pick<InitiativeThread, "id" | "code">): Promise<void> {
  try {
    const { data } = await createAdminClient().from("mentors").select("profile_id").eq("id", mentorId).maybeSingle();
    const profileId = (data?.profile_id as string | null) ?? null;
    const target = profileId ? { user_id: profileId } : { role: mentorRole(mentorId) };
    await notify({ ...target, kind: "prosba_mentora", payload: { initiativeId: t.id, code: t.code } });
  } catch (e) {
    console.error("[mentor] powiadomienie o przypisaniu:", e);
  }
}
