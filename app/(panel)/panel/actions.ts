"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { emailAuthor, emailTester } from "@/lib/author-contact";
import { requireAdmin } from "@/lib/auth";
import { notifyExpert } from "@/lib/expert";
import { NEED_STATUS_LABELS, type NeedStatus } from "@/lib/need-status";
import { innovationHref } from "@/lib/knowledge/hrefs";
import { notify } from "@/lib/notifications";
import { postPartnershipMessage } from "@/lib/partnerships";
import { logChange } from "@/lib/panel/needs";
import { anonymize } from "@/lib/pii";
import { NEED_STATUSES, TEST_STATUSES } from "@/lib/schemas";
import { keywordSearch } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEST_STATUS_LABELS } from "@/lib/test-status";
import { ensureThread, expertName, needThread, nudge, postNeedMessage, setReportStatus, threadPayload } from "@/lib/threads";

export type ActionResult = { ok: boolean; message: string } | null;

const SAVE_FAILED: ActionResult = { ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." };
const NOT_FOUND: ActionResult = { ok: false, message: "Nie znaleziono zgłoszenia. Odśwież stronę." };

/** Zapis zmiany statusu (albo samej wiadomości, gdy status bez zmian) + ślad w audit_log + powiadomienie autora, jeśli ma konto. */
async function setStatus(
  actorId: string | null,
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
  // Zamknięta potrzeba nie liczy się do „inne gminy zgłosiły podobny problem” ani do duplikatów.
  if (from !== patch.status && (from === "zamkniete" || patch.status === "zamkniete")) {
    const { error: iError } = await supabase
      .from("search_index")
      .update({ active: patch.status !== "zamkniete" })
      .eq("kind", "potrzeba")
      .eq("ref_id", needId);
    if (iError) throw iError;
  }
  if (authorId) {
    await notify({
      user_id: authorId,
      kind: from === patch.status ? "wiadomosc" : "zmiana_statusu",
      payload: { needId, status: patch.status },
    }).catch((e) => console.error("[panel] powiadomienie:", e));
  }
  // Autor bez konta dowie się z e-maila, jeśli go podał (#65).
  await emailAuthor("potrzeba", needId, from === patch.status
    ? "ROPS dodał wiadomość do zgłoszenia"
    : `Zgłoszenie ma nowy status: ${NEED_STATUS_LABELS[patch.status]}`);
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
    // Ekspert dostaje prośbę w dzwonku i otwiera zgłoszenie u siebie, w /ekspert (#63).
    const assigned = await needThread({ kind: "potrzeba", id: needId });
    if (assigned) await notifyExpert(expertId, assigned);
  } catch (e) {
    console.error("[panel] ekspert:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: `Przypisano eksperta: ${name}.` };
}

const ReplyInput = z.object({
  kind: z.enum(["potrzeba", "pomysl"]),
  id: z.uuid(),
  as: z.enum(["rops", "ekspert"]),
  body: z.string().trim().min(2).max(2000),
});

/**
 * Odpowiedź w rozmowie o zgłoszeniu albo pomyśle. Eksperci są na razie tylko w indeksie (bez kont),
 * więc w demo admin może napisać w imieniu eksperta wątku — podpis to jego nazwa.
 */
export async function replyInThread(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = ReplyInput.safeParse({
    kind: formData.get("kind"),
    id: formData.get("id"),
    as: formData.get("as"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { ok: false, message: "Wpisz wiadomość (od 2 do 2000 znaków)." };
  const { kind, id, as, body } = parsed.data;

  try {
    const thread = await needThread({ kind, id });
    if (!thread) return NOT_FOUND;
    if (thread.status === "zamkniete") return { ok: false, message: "To zgłoszenie jest zamknięte. Najpierw zmień status." };
    if (as === "ekspert" && !thread.expert) return { ok: false, message: "Ta rozmowa nie ma eksperta. Najpierw go przypisz." };
    await postNeedMessage(thread, {
      role: as,
      name: as === "ekspert" ? thread.expert!.name : undefined,
      // Bez anonymize(): odpowiedź ROPS może celowo podawać telefon albo adres instytucji.
      body,
      actorId: user.id,
    });
  } catch (e) {
    console.error("[panel] rozmowa:", e);
    return { ok: false, message: "Nie udało się wysłać. Spróbuj ponownie." };
  }
  refresh();
  return {
    ok: true,
    message: kind === "pomysl"
      ? "Wysłano. Autor pomysłu zobaczy wiadomość w rozmowie."
      : "Wysłano. Zgłaszający zobaczy wiadomość po wpisaniu kodu.",
  };
}

const AssignIdeaInput = z.object({ ideaId: z.uuid(), expertId: z.uuid() });

/**
 * Ekspert pomysłu. Pomysły nie mają kolumny assigned_expert — ekspert jest zapisany w wątku (threads.expert_id),
 * jak ten wybrany przez autora w „Zapytaj eksperta”. Status i oś czasu jak przy potrzebach.
 */
export async function assignIdeaExpert(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = AssignIdeaInput.safeParse({ ideaId: formData.get("ideaId"), expertId: formData.get("expertId") });
  if (!parsed.success) return { ok: false, message: "Wybierz eksperta." };
  const { ideaId, expertId } = parsed.data;

  let name: string | null;
  try {
    const thread = await needThread({ kind: "pomysl", id: ideaId });
    if (!thread) return { ok: false, message: "Nie znaleziono pomysłu. Odśwież stronę." };
    name = await expertName(expertId);
    if (!name) return { ok: false, message: "Nie znaleziono tego eksperta. Odśwież stronę." };
    await ensureThread(thread, expertId, true);
    await setReportStatus(thread, "ekspert", user.id, "idea.assign_expert", { expertId, note: `Zajmie się tym: ${name}` });
    await notifyExpert(expertId, thread);
    if (thread.authorId) {
      await notify({ user_id: thread.authorId, kind: "zmiana_statusu", payload: threadPayload(thread, { status: "ekspert" }) })
        .catch((e) => console.error("[panel] powiadomienie:", e));
    }
    await emailAuthor("pomysl", ideaId, `Pomysł ma nowy status: ${NEED_STATUS_LABELS.ekspert}`);
  } catch (e) {
    console.error("[panel] ekspert pomysłu:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: `Przypisano eksperta: ${name}.` };
}

const PartnershipReplyInput = z.object({ threadId: z.uuid(), body: z.string().trim().min(2).max(2000) });

/** ROPS prowadzi każde partnerstwo gmin: pisze jako „ROPS Kraków”, gminy z kontem dostają powiadomienie. */
export async function replyInPartnership(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = PartnershipReplyInput.safeParse({ threadId: formData.get("threadId"), body: formData.get("body") });
  if (!parsed.success) return { ok: false, message: "Wpisz wiadomość (od 2 do 2000 znaków)." };
  try {
    await postPartnershipMessage(parsed.data.threadId, { actorId: user.id }, parsed.data.body);
  } catch (e) {
    console.error("[panel] partnerstwo:", e);
    return { ok: false, message: "Nie udało się wysłać. Spróbuj ponownie." };
  }
  refresh();
  return { ok: true, message: "Wysłano. Zobaczą ją wszystkie gminy w partnerstwie." };
}

const ModerateInput = z.object({ threadId: z.uuid(), messageId: z.uuid() });

/** Moderacja: wiadomość gminy znika z partnerstwa (np. dane osobowe, których nie wyłapała anonimizacja). Ślad w audit_log. */
export async function removePartnershipMessage(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = ModerateInput.safeParse({ threadId: formData.get("threadId"), messageId: formData.get("messageId") });
  if (!parsed.success) return { ok: false, message: "Nie znaleziono wiadomości. Odśwież stronę." };
  const { threadId, messageId } = parsed.data;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("messages").delete().eq("id", messageId).eq("thread_id", threadId).select("author_name").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, message: "Nie znaleziono wiadomości. Odśwież stronę." };
    await logChange(user.id, "partnership.remove_message", "thread", threadId, { author: data.author_name });
    await nudge(threadId);
  } catch (e) {
    console.error("[panel] moderacja:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: "Usunięto wiadomość z partnerstwa." };
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

const IdeaStatusInput = z.object({
  ideaId: z.uuid(),
  status: z.enum(NEED_STATUSES).exclude(["luka"]),
});

/** Status pomysłu; autor widzi go na /status/[kod]. */
export async function updateIdeaStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = IdeaStatusInput.safeParse({ ideaId: formData.get("ideaId"), status: formData.get("status") });
  if (!parsed.success) return { ok: false, message: "Wybierz nowy status." };
  const { ideaId, status } = parsed.data;

  try {
    const supabase = createAdminClient();
    const { data: before, error } = await supabase.from("ideas").select("status").eq("id", ideaId).maybeSingle();
    if (error) throw error;
    if (!before) return { ok: false, message: "Nie znaleziono pomysłu. Odśwież stronę." };
    if (before.status === status) return { ok: false, message: "Wybierz inny status." };
    const { error: updateError } = await supabase.from("ideas").update({ status }).eq("id", ideaId);
    if (updateError) throw updateError;
    await logChange(user.id, "idea.status", "idea", ideaId, { from: before.status, to: status });
    await emailAuthor("pomysl", ideaId, `Pomysł ma nowy status: ${NEED_STATUS_LABELS[status]}`);
  } catch (e) {
    console.error("[panel] status pomysłu:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: `Zapisano status: ${NEED_STATUS_LABELS[status]}.` };
}

const TestStatusInput = z.object({ testId: z.uuid(), status: z.enum(TEST_STATUSES) });

/** Status testu z Próby, np. „Pilotaż potwierdzony”. Tester z kontem dostaje powiadomienie, tester z adresem — e-mail. */
export async function updateTestStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = TestStatusInput.safeParse({ testId: formData.get("testId"), status: formData.get("status") });
  if (!parsed.success) return { ok: false, message: "Wybierz nowy status." };
  const { testId, status } = parsed.data;

  try {
    const supabase = createAdminClient();
    const { data: before, error } = await supabase
      .from("tests")
      .select("status, tester_id, contact_email, synthetic, innovations(title, slug)")
      .eq("id", testId)
      .maybeSingle();
    if (error) throw error;
    if (!before) return { ok: false, message: "Nie znaleziono testu. Odśwież stronę." };
    if (before.status === status) return { ok: false, message: "Wybierz inny status." };
    const { error: updateError } = await supabase.from("tests").update({ status }).eq("id", testId);
    if (updateError) throw updateError;
    await logChange(user.id, "test.status", "test", testId, { from: before.status, to: status });
    const innovation = before.innovations as unknown as { title: string; slug: string | null } | null;
    if (before.contact_email && !before.synthetic) {
      await emailTester(before.contact_email, innovation?.title ?? null, TEST_STATUS_LABELS[status],
        innovation?.slug ? innovationHref(innovation.slug) : null);
    }
    if (before.tester_id) {
      await notify({
        user_id: before.tester_id,
        kind: "zmiana_statusu_testu",
        payload: { testId, status, title: innovation?.title ?? null, slug: innovation?.slug ?? null },
      }).catch((e) => console.error("[panel] powiadomienie testera:", e));
    }
  } catch (e) {
    console.error("[panel] status testu:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: `Zapisano status testu: ${TEST_STATUS_LABELS[status]}.` };
}

/**
 * Co usuwamy i co z tym sprzątamy. `kind` to rodzaj w search_index i threads, `payloadKey` — id w powiadomieniach.
 * Klucze obce (dopasowania, szkice wniosków, powiązanie pomysłu z potrzebą) obsługuje baza: 0014_delete_reports.sql.
 */
const DELETABLE = {
  need: { table: "needs", kind: "potrzeba", payloadKey: "needId", list: "/panel" },
  idea: { table: "ideas", kind: "pomysl", payloadKey: "ideaId", list: "/panel/pomysly" },
  call: { table: "calls", kind: "nabor", payloadKey: "callId", list: "/panel/nabory" },
} as const;

const DeleteInput = z.object({ entity: z.enum(["need", "idea", "call"]), id: z.uuid() });

/** Trwałe usunięcie zgłoszenia, pomysłu albo naboru razem z rozmową, wpisem w wyszukiwarce i powiadomieniami. */
export async function deleteRecord(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (formData.get("confirm") !== "on") return { ok: false, message: "Zaznacz, że rozumiesz, że usunięcia nie można cofnąć." };
  const parsed = DeleteInput.safeParse({ entity: formData.get("entity"), id: formData.get("id") });
  if (!parsed.success) return { ok: false, message: "Nie wiadomo, co usunąć. Odśwież stronę." };
  const { entity, id } = parsed.data;
  const target = DELETABLE[entity];

  const supabase = createAdminClient();
  try {
    const { data, error } = await supabase.from(target.table).delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) return { ok: false, message: "Tego już nie ma. Odśwież stronę." };
  } catch (e) {
    console.error("[panel] usuwanie:", e);
    return { ok: false, message: "Nie udało się usunąć. Spróbuj ponownie." };
  }

  // Rekord już zniknął: błąd sprzątania tylko logujemy, bo ponowna próba skończyłaby się na „Tego już nie ma”.
  const followUp = await Promise.allSettled([
    supabase.from("threads").delete().eq("entity_kind", target.kind).eq("entity_id", id).throwOnError(),
    supabase.from("search_index").delete().eq("kind", target.kind).eq("ref_id", id).throwOnError(),
    // Powiadomienia mają kopię opisu, więc znikają razem z rekordem.
    supabase.from("notifications").delete().eq(`payload->>${target.payloadKey}`, id).throwOnError(),
    logChange(user.id, `${entity}.delete`, entity, id, {}),
  ]);
  for (const r of followUp) if (r.status === "rejected") console.error(`[panel] sprzątanie po usunięciu ${entity} ${id}:`, r.reason);
  redirect(`${target.list}?usunieto=${entity}`);
}

/**
 * Włącznik naboru. Przy otwarciu: autorzy pasujących pomysłów dostają powiadomienie
 * (README §6, powiadomienia proaktywne).
 */
export async function setCallActive(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";

  const supabase = createAdminClient();
  const { data: call, error } = await supabase.from("calls").update({ active }).eq("id", id).select("id, title").single();
  if (error) throw error;
  await Promise.all([
    supabase.from("search_index").update({ active }).eq("kind", "nabor").eq("ref_id", id),
    logChange(user.id, active ? "call.open" : "call.close", "call", id, { active }),
  ]);

  if (active) {
    try {
      const { data: indexed } = await supabase.from("search_index").select("lemmas").eq("kind", "nabor").eq("ref_id", id).maybeSingle();
      const lemmas = ((indexed?.lemmas as string | undefined) ?? call.title.toLowerCase()).split(/\s+/).filter(Boolean);
      const hits = (await keywordSearch("pomysl", lemmas, 30)).filter((h) => h.similarity >= 0.25);
      if (hits.length) {
        const { data: ideas } = await supabase.from("ideas").select("id, author_id, contact_email").in("id", hits.map((h) => h.ref_id));
        const authors = [...new Set((ideas ?? []).map((i) => i.author_id as string | null).filter((a): a is string => !!a))];
        if (authors.length) {
          await notify(authors.map((user_id) => ({ user_id, kind: "nowy_nabor", payload: { callId: call.id, title: call.title } })));
        }
        // Autorzy bez konta, którzy zostawili e-mail.
        for (const idea of (ideas ?? []).filter((i) => i.contact_email)) {
          await emailAuthor("pomysl", idea.id as string, `Ruszył nabór „${call.title}”, możesz złożyć wniosek`);
        }
      }
    } catch (e) {
      console.error("[panel] powiadomienia o naborze:", e);
    }
  }
  refresh();
}
