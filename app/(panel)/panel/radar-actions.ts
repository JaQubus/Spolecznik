"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { emailAuthor } from "@/lib/author-contact";
import { requireAdmin } from "@/lib/auth";
import { moveFunnel, advanceFunnel } from "@/lib/funnel";
import { MERGE_MESSAGES, mergeProblem } from "@/lib/panel/merge";
import { logChange } from "@/lib/panel/initiatives";
import { org, STATUS_CODE } from "@/lib/brand";
import { anonymize } from "@/lib/pii";
import { FUNNEL_KEYS, funnelLabel } from "@/lib/taxonomy";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./actions";

/** Akcje Panelu z 9/10: lejek, scalanie duplikatów, partner przy innowacji, partnerzy, opiekunowie instytucji. */

const FAILED: ActionResult = { ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." };
const NOT_FOUND: ActionResult = { ok: false, message: "Nie znaleziono. Odśwież stronę." };

// ── Lejek ───────────────────────────────────────────────────

const FunnelInput = z.object({
  initiativeId: z.uuid(),
  stage: z.enum(FUNNEL_KEYS),
  note: z.string().trim().max(500).optional(),
});

/** Przesunięcie innowacji w lejku (tylko do przodu, jak advance_funnel). Notatka przechodzi przez maskowanie danych osobowych. */
export async function moveFunnelStage(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = FunnelInput.safeParse({
    initiativeId: formData.get("initiativeId"), stage: formData.get("stage"), note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Wybierz etap lejka." };
  const { initiativeId, stage } = parsed.data;
  const note = parsed.data.note ? anonymize(parsed.data.note).text : undefined;
  try {
    const { changed } = await moveFunnel(initiativeId, stage, user.id, note);
    if (!changed) return { ok: false, message: `Ta innowacja jest już na etapie „${funnelLabel(stage)}” albo dalej. Notatka trafiła do historii.` };
    await logChange(user.id, "initiative.funnel", "initiative", initiativeId, { to: stage, note: note ?? null });
  } catch (e) {
    console.error("[panel] lejek:", e);
    return FAILED;
  }
  refresh();
  return { ok: true, message: `Przesunięto na etap: ${funnelLabel(stage)}.` };
}

// ── Scalanie duplikatów ─────────────────────────────────────

const MergeInput = z.object({
  initiativeId: z.uuid(),
  targetId: z.uuid().optional(),
  targetCode: z.string().trim().toUpperCase().regex(STATUS_CODE).optional(),
});

/**
 * To zgłoszenie staje się duplikatem innej inicjatywy (duplicate_of). Znika z list, publicznej bazy i wyszukiwania,
 * a jego autor dostaje wiadomość. Cel podajemy kodem (RAD-…) albo przyciskiem przy możliwym duplikacie.
 */
export async function mergeDuplicate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = MergeInput.safeParse({
    initiativeId: formData.get("initiativeId"), targetId: formData.get("targetId") || undefined, targetCode: formData.get("targetCode") || undefined,
  });
  if (!parsed.success || (!parsed.data.targetId && !parsed.data.targetCode)) return { ok: false, message: "Podaj kod inicjatywy, z którą scalić (np. RAD-4K7Q)." };
  const { initiativeId, targetId, targetCode } = parsed.data;

  let targetTitle: string;
  try {
    const supabase = createAdminClient();
    const [source, merged, target] = await Promise.all([
      supabase.from("initiatives").select("id, duplicate_of, status_code").eq("id", initiativeId).maybeSingle(),
      supabase.from("initiatives").select("id", { count: "exact", head: true }).eq("duplicate_of", initiativeId),
      (targetId ? supabase.from("initiatives").select("id, duplicate_of, status_code, title").eq("id", targetId) : supabase.from("initiatives").select("id, duplicate_of, status_code, title").eq("status_code", targetCode!)).maybeSingle(),
    ]);
    if (source.error) throw source.error;
    if (merged.error) throw merged.error;
    if (target.error) throw target.error;
    if (!source.data) return NOT_FOUND;
    const problem = mergeProblem(
      { id: source.data.id as string, duplicate_of: source.data.duplicate_of as string | null, mergedCount: merged.count ?? 0 },
      target.data ? { id: target.data.id as string, duplicate_of: target.data.duplicate_of as string | null } : null,
    );
    if (problem) return { ok: false, message: MERGE_MESSAGES[problem] };
    targetTitle = target.data!.title as string;

    const { error } = await supabase
      .from("initiatives").update({ duplicate_of: target.data!.id, published: false, updated_at: new Date().toISOString() }).eq("id", initiativeId);
    if (error) throw error;
    const index = await supabase.from("search_index").update({ active: false }).eq("kind", "initiative").eq("ref_id", initiativeId);
    if (index.error) console.error("[panel] scalanie, indeks:", index.error);
    await logChange(user.id, "initiative.merge", "initiative", initiativeId, { target: target.data!.status_code, note: `Scalono z ${target.data!.status_code}` });
    await advanceFunnel(initiativeId, "zarchiwizowana", "panel", { actorId: user.id, note: `Duplikat ${target.data!.status_code}` });
    await emailAuthor(initiativeId, `Twoje zgłoszenie połączono z podobnym, które już mamy (${org.short})`);
  } catch (e) {
    console.error("[panel] scalanie:", e);
    return FAILED;
  }
  refresh();
  return { ok: true, message: `Scalono z: ${targetTitle}. Zgłoszenie zniknęło z list i z publicznej bazy.` };
}

/** Cofnięcie scalenia: zgłoszenie wraca na listy jako nieopublikowane (etap lejka zostaje, bo lejek idzie tylko do przodu). */
export async function unmergeDuplicate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = z.object({ initiativeId: z.uuid() }).safeParse({ initiativeId: formData.get("initiativeId") });
  if (!parsed.success) return NOT_FOUND;
  const id = parsed.data.initiativeId;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("initiatives").select("duplicate_of, status").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data?.duplicate_of) return { ok: false, message: "To zgłoszenie nie jest scalone." };
    const { error: updateError } = await supabase.from("initiatives").update({ duplicate_of: null, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) throw updateError;
    if (data.status !== "archived") await supabase.from("search_index").update({ active: true }).eq("kind", "initiative").eq("ref_id", id);
    await logChange(user.id, "initiative.unmerge", "initiative", id, { from: data.duplicate_of });
  } catch (e) {
    console.error("[panel] cofnięcie scalenia:", e);
    return FAILED;
  }
  refresh();
  return { ok: true, message: "Cofnięto scalenie. Zgłoszenie jest nieopublikowane; opublikuj je ponownie, jeśli trzeba." };
}

// ── Partner przy innowacji ──────────────────────────────────

const AssignPartnerInput = z.object({ initiativeId: z.uuid(), partnerId: z.union([z.uuid(), z.literal("")]) });

/**
 * Przypisanie partnera, któremu zespół kieruje innowację (initiatives.assigned_partner). Pusty wybór zdejmuje przypisanie.
 * Przypisanie przesuwa lejek na „skierowana”, ale nie otwiera kontaktu: ten wymaga zgody obu stron (pathway-actions).
 */
export async function assignPartner(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = AssignPartnerInput.safeParse({ initiativeId: formData.get("initiativeId"), partnerId: formData.get("partnerId") ?? "" });
  if (!parsed.success) return { ok: false, message: "Wybierz partnera." };
  const { initiativeId, partnerId } = parsed.data;
  let name: string | null = null;
  try {
    const supabase = createAdminClient();
    if (partnerId) {
      const { data, error } = await supabase.from("partners").select("name").eq("id", partnerId).eq("active", true).maybeSingle();
      if (error) throw error;
      if (!data) return { ok: false, message: "Nie znaleziono aktywnego partnera. Odśwież stronę." };
      name = data.name as string;
    }
    const { data: updated, error } = await supabase
      .from("initiatives").update({ assigned_partner: partnerId || null, updated_at: new Date().toISOString() }).eq("id", initiativeId).select("id");
    if (error) throw error;
    if (!updated?.length) return NOT_FOUND;
    await logChange(user.id, "initiative.assign_partner", "initiative", initiativeId, { partnerId: partnerId || null, note: name ? `Skierowano do: ${name}` : "Zdjęto przypisanie partnera" });
    if (name) await advanceFunnel(initiativeId, "skierowana", "panel", { actorId: user.id, note: `Przypisano partnera: ${name}` });
  } catch (e) {
    console.error("[panel] przypisanie partnera:", e);
    return FAILED;
  }
  refresh();
  return { ok: true, message: name ? `Przypisano partnera: ${name}.` : "Zdjęto przypisanie partnera." };
}

// ── Partnerzy ───────────────────────────────────────────────

const PartnerActiveInput = z.object({ partnerId: z.uuid(), active: z.enum(["true", "false"]) });

/** Zatwierdzenie profilu partnera z formularza „Szukam innowacji” (albo wyłączenie). Nieaktywny partner nie bierze udziału w dopasowaniu. */
export async function setPartnerActive(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = PartnerActiveInput.safeParse({ partnerId: formData.get("partnerId"), active: formData.get("active") });
  if (!parsed.success) return NOT_FOUND;
  const active = parsed.data.active === "true";
  try {
    const { data, error } = await createAdminClient().from("partners").update({ active }).eq("id", parsed.data.partnerId).select("name").maybeSingle();
    if (error) throw error;
    if (!data) return NOT_FOUND;
    await logChange(user.id, active ? "partner.approve" : "partner.deactivate", "partner", parsed.data.partnerId, { name: data.name });
  } catch (e) {
    console.error("[panel] partner:", e);
    return FAILED;
  }
  refresh();
  return { ok: true, message: active ? "Zatwierdzono. Partner bierze udział w dopasowaniu." : "Wyłączono partnera z dopasowania." };
}

// ── Opiekunowie instytucji ──────────────────────────────────

const KeeperInput = z.object({ institutionId: z.uuid(), email: z.string().trim().toLowerCase().pipe(z.email("To nie wygląda jak adres e-mail.")) });

/** Konto Supabase o adresie e-mail (administracyjne API; konta jest niewiele, więc przeglądamy strony listy). */
async function findUserByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient().auth.admin;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Przypisanie opiekuna do instytucji: konto (po adresie e-mail, musi już się zalogować) dostaje rolę „institution”
 * i widzi w Panelu tylko jej innowacje. Gdy instytucja ma domenę służbową, adres musi do niej należeć.
 */
export async function assignKeeper(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = KeeperInput.safeParse({ institutionId: formData.get("institutionId"), email: formData.get("email") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Wpisz adres e-mail opiekuna." };
  const { institutionId, email } = parsed.data;
  try {
    const supabase = createAdminClient();
    const { data: inst, error } = await supabase.from("institutions").select("name, email_domain").eq("id", institutionId).maybeSingle();
    if (error) throw error;
    if (!inst) return NOT_FOUND;
    if (inst.email_domain && !email.endsWith(`@${inst.email_domain}`)) {
      return { ok: false, message: `Adres musi być z domeny instytucji: @${inst.email_domain}.` };
    }
    const userId = await findUserByEmail(email);
    if (!userId) return { ok: false, message: "Ta osoba jeszcze się nie logowała. Poproś, żeby weszła na stronę logowania i użyła linku na e-mail, a potem przypisz ją." };
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return { ok: false, message: "To konto nie ma jeszcze profilu. Poproś o ponowne zalogowanie." };
    if (profile.role === "admin" || profile.role === "mentor") return { ok: false, message: `To konto ma już rolę „${profile.role === "admin" ? "administrator" : "mentor"}”. Użyj innego konta.` };
    const { error: updateError } = await supabase.from("profiles").update({ role: "institution", institution_id: institutionId }).eq("id", userId);
    if (updateError) throw updateError;
    await logChange(user.id, "institution.assign_keeper", "institution", institutionId, { userId, note: `Opiekun instytucji: ${inst.name}` });
  } catch (e) {
    console.error("[panel] opiekun:", e);
    return FAILED;
  }
  refresh();
  return { ok: true, message: "Przypisano opiekuna. Po następnym wejściu do Panelu zobaczy innowacje swojej instytucji." };
}

const RemoveKeeperInput = z.object({ profileId: z.uuid() });

export async function removeKeeper(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = RemoveKeeperInput.safeParse({ profileId: formData.get("profileId") });
  if (!parsed.success) return NOT_FOUND;
  try {
    const { data, error } = await createAdminClient()
      .from("profiles").update({ role: "author", institution_id: null }).eq("id", parsed.data.profileId).eq("role", "institution").select("institution_id");
    if (error) throw error;
    if (!data?.length) return NOT_FOUND;
    await logChange(user.id, "institution.remove_keeper", "profile", parsed.data.profileId, {});
  } catch (e) {
    console.error("[panel] zdjęcie opiekuna:", e);
    return FAILED;
  }
  refresh();
  return { ok: true, message: "Zdjęto dostęp opiekuna." };
}
