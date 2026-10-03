"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { NEED_STATUS_LABELS, type NeedStatus } from "@/lib/need-status";
import { logChange } from "@/lib/panel/needs";
import { anonymize } from "@/lib/pii";
import { NEED_STATUSES } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: boolean; message: string } | null;

const SAVE_FAILED: ActionResult = { ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." };
const NOT_FOUND: ActionResult = { ok: false, message: "Nie znaleziono zgłoszenia. Odśwież stronę." };

/** Zapis zmiany statusu (albo samej wiadomości, gdy status bez zmian) + ślad w audit_log + powiadomienie autora, jeśli ma konto. */
async function setStatus(
  actorId: string,
  needId: string,
  from: NeedStatus,
  authorId: string | null,
  patch: { status: NeedStatus; assigned_expert?: string },
  action: string,
  diffExtra: Record<string, unknown>,
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("needs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", needId);
  if (error) throw error;
  await logChange(actorId, action, "need", needId, { from, to: patch.status, ...diffExtra });
  if (authorId) {
    const { error: nError } = await supabase.from("notifications").insert({
      user_id: authorId,
      kind: from === patch.status ? "wiadomosc" : "zmiana_statusu",
      payload: { needId, status: patch.status },
    });
    if (nError) console.error("[panel] powiadomienie:", nError);
  }
}

async function loadNeed(needId: string) {
  const { data, error } = await createAdminClient()
    .from("needs")
    .select("status, author_id, raw_text")
    .eq("id", needId)
    .maybeSingle();
  if (error) throw error;
  return data as { status: NeedStatus; author_id: string | null; raw_text: string | null } | null;
}

const StatusInput = z.object({
  needId: z.uuid(),
  status: z.enum(NEED_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

export async function updateNeedStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = StatusInput.safeParse({
    needId: formData.get("needId"),
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Wybierz nowy status." };
  const { needId, status, note } = parsed.data;

  // Ten sam status + wiadomość = sama wiadomość dla zgłaszającego (np. poprawka albo bieżąca informacja).
  let noteOnly: boolean;
  try {
    const need = await loadNeed(needId);
    if (!need) return NOT_FOUND;
    noteOnly = need.status === status;
    if (noteOnly && !note) return { ok: false, message: "Wybierz inny status albo wpisz wiadomość." };
    await setStatus(
      user.id, needId, need.status, need.author_id, { status },
      noteOnly ? "need.note" : "need.status",
      { note: note ?? null },
    );
  } catch (e) {
    console.error("[panel] status:", e);
    return SAVE_FAILED;
  }
  refresh();
  return {
    ok: true,
    message: noteOnly ? "Zapisano wiadomość dla zgłaszającego." : `Zapisano status: ${NEED_STATUS_LABELS[status]}.`,
  };
}

const AssignInput = z.object({ needId: z.uuid(), expertId: z.uuid() });

export async function assignExpert(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = AssignInput.safeParse({ needId: formData.get("needId"), expertId: formData.get("expertId") });
  if (!parsed.success) return { ok: false, message: "Wybierz eksperta." };
  const { needId, expertId } = parsed.data;

  let name: string;
  try {
    const need = await loadNeed(needId);
    if (!need) return NOT_FOUND;
    // Eksperci są na razie tylko w indeksie (lib/match.ts czyta imię z title).
    const { data: expert, error } = await createAdminClient()
      .from("search_index")
      .select("title")
      .eq("kind", "ekspert")
      .eq("ref_id", expertId)
      .maybeSingle();
    if (error) throw error;
    if (!expert) return { ok: false, message: "Nie znaleziono tego eksperta. Odśwież stronę." };
    name = expert.title;
    await setStatus(
      user.id, needId, need.status, need.author_id,
      { status: "ekspert", assigned_expert: expertId },
      "need.assign_expert",
      { expertId, note: `Zajmie się tym: ${name}` },
    );
  } catch (e) {
    console.error("[panel] ekspert:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: `Przypisano eksperta: ${name}.` };
}

const NeedIdInput = z.object({ needId: z.uuid() });

/** Nadpisuje surową treść wersją zanonimizowaną (RODO: minimalizacja). Nie da się tego cofnąć. */
export async function removePersonalData(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = NeedIdInput.safeParse({ needId: formData.get("needId") });
  if (!parsed.success) return NOT_FOUND;
  const { needId } = parsed.data;

  try {
    const need = await loadNeed(needId);
    if (!need) return NOT_FOUND;
    const { text, found } = anonymize(need.raw_text ?? "");
    if (!found) return { ok: true, message: "W treści nie ma już danych, które umiemy rozpoznać." };
    const { error } = await createAdminClient().from("needs").update({ raw_text: text }).eq("id", needId);
    if (error) throw error;
    await logChange(user.id, "need.remove_pii", "need", needId, { field: "raw_text" });
  } catch (e) {
    console.error("[panel] dane osobowe:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: "Usunięto rozpoznane dane osobowe z treści." };
}
