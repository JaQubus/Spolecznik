"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { emailAuthor } from "@/lib/author-contact";
import { sendAlertsFor } from "@/lib/innovations/alerts-send";
import { requireAdmin } from "@/lib/auth";
import { statusLabel, type InitiativeStatus } from "@/lib/initiatives/status";
import { notify } from "@/lib/notifications";
import { logChange } from "@/lib/panel/initiatives";
import { anonymize } from "@/lib/pii";
import { GroqBusyError } from "@/lib/groq";
import { assessInitiative } from "@/lib/radar";
import { INITIATIVE_STATUSES, SignalOverrideInput } from "@/lib/schemas";
import { keywordSearch } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";
import { initiativeThread, postStaffMessage } from "@/lib/threads";
import { org } from "@/lib/brand";

export type ActionResult = { ok: boolean; message: string } | null;

/** Alerty dla partnerów o świeżo opublikowanej innowacji. Błąd tylko logujemy: publikacja już się udała. */
const alertPartners = (id: string) => sendAlertsFor(id).catch((e) => console.error("[panel] alerty dla partnerów:", e));

const SAVE_FAILED: ActionResult = { ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." };
const NOT_FOUND: ActionResult = { ok: false, message: "Nie znaleziono inicjatywy. Odśwież stronę." };

type InitiativeBasics = { status: InitiativeStatus; author_id: string | null; raw_text: string | null; published: boolean; status_code: string };

async function loadInitiative(id: string): Promise<InitiativeBasics | null> {
  const { data, error } = await createAdminClient()
    .from("initiatives")
    .select("status, author_id, raw_text, published, status_code")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as InitiativeBasics | null;
}

/** Zamknięta inicjatywa nie liczy się do podobnych inicjatyw z innych gmin ani do duplikatów. */
async function syncIndex(id: string, active: boolean) {
  const { error } = await createAdminClient().from("search_index").update({ active }).eq("kind", "initiative").eq("ref_id", id);
  if (error) throw error;
}

/** Powiadomienie i e-mail do autora po zmianie w Panelu. Błędy tylko logujemy. */
async function tellAuthor(id: string, i: InitiativeBasics, kind: "zmiana_statusu" | "wiadomosc", status: InitiativeStatus, what: string) {
  if (i.author_id) {
    await notify({ user_id: i.author_id, kind, payload: { initiativeId: id, code: i.status_code, status } })
      .catch((e) => console.error("[panel] powiadomienie:", e));
  }
  await emailAuthor(id, what);
}

const StatusInput = z.object({
  initiativeId: z.uuid(),
  status: z.enum(INITIATIVE_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

/** Zmiana statusu (albo sama wiadomość dla autora, gdy status bez zmian) + ślad w audit_log (oś czasu na /status/[kod]). */
export async function updateInitiativeStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = StatusInput.safeParse({
    initiativeId: formData.get("initiativeId"),
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Wybierz nowy status." };
  const { initiativeId: id, status, note } = parsed.data;

  let noteOnly: boolean;
  try {
    const i = await loadInitiative(id);
    if (!i) return NOT_FOUND;
    noteOnly = i.status === status;
    if (noteOnly && !note) return { ok: false, message: "Wybierz inny status albo wpisz wiadomość." };
    if (!noteOnly) {
      // Wyróżnienie bez publikacji nie miałoby sensu: wyróżniona inicjatywa trafia do bazy i na mapę.
      const publish = status === "featured" || status === "supported" || status === "scaling" ? { published: true } : {};
      const { error } = await createAdminClient()
        .from("initiatives").update({ status, ...publish, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      if (i.status === "archived" || status === "archived") await syncIndex(id, status !== "archived");
      if ("published" in publish && !i.published) await alertPartners(id);
    }
    await logChange(user.id, noteOnly ? "initiative.note" : "initiative.status", "initiative", id, {
      from: i.status, to: status, note: note ?? null,
    });
    await tellAuthor(id, i, noteOnly ? "wiadomosc" : "zmiana_statusu", status,
      noteOnly ? `Zespół ${org.short} dodał wiadomość do zgłoszenia` : `Zgłoszenie ma nowy status: ${statusLabel(status)}`);
  } catch (e) {
    console.error("[panel] status:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: noteOnly ? "Zapisano wiadomość dla autora." : `Zapisano status: ${statusLabel(status)}.` };
}

const PublishInput = z.object({ initiativeId: z.uuid(), published: z.enum(["true", "false"]) });

/** Publikacja: dopiero po niej inicjatywa jest w publicznej bazie i w API. */
export async function setPublished(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = PublishInput.safeParse({ initiativeId: formData.get("initiativeId"), published: formData.get("published") });
  if (!parsed.success) return NOT_FOUND;
  const id = parsed.data.initiativeId;
  const published = parsed.data.published === "true";
  try {
    const i = await loadInitiative(id);
    if (!i) return NOT_FOUND;
    const { error } = await createAdminClient().from("initiatives").update({ published, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    await logChange(user.id, published ? "initiative.publish" : "initiative.unpublish", "initiative", id, { published });
    if (published && !i.published) await alertPartners(id);
  } catch (e) {
    console.error("[panel] publikacja:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: published ? "Opublikowano. Inicjatywa jest w publicznej bazie." : "Ukryto inicjatywę z publicznej bazy." };
}

const RadarInput = z.object({ initiativeId: z.uuid() });

/** „Oceń ponownie”: nowa ocena modelu z regułami (lib/radar). Ręczna korekta sygnału zostaje. */
export async function reassessRadar(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = RadarInput.safeParse({ initiativeId: formData.get("initiativeId") });
  if (!parsed.success) return NOT_FOUND;
  const id = parsed.data.initiativeId;
  let signal: number;
  try {
    const before = await createAdminClient().from("initiatives").select("signal").eq("id", id).maybeSingle();
    if (before.error) throw before.error;
    if (!before.data) return NOT_FOUND;
    signal = (await assessInitiative(id)).signal;
    await logChange(user.id, "initiative.radar", "initiative", id, { from: before.data.signal, to: signal });
  } catch (e) {
    if (e instanceof GroqBusyError) return { ok: false, message: "AI jest teraz zajęte. Spróbuj ponownie za minutę." };
    console.error("[panel] ocena radaru:", e);
    return { ok: false, message: "Nie udało się ocenić. Spróbuj ponownie." };
  }
  refresh();
  return { ok: true, message: `Nowa ocena: sygnał ${signal}/100.` };
}

/** Ręczna korekta sygnału zawsze z powodem — powód trafia do audit_log, pusty sygnał usuwa korektę. */
export async function overrideSignal(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = SignalOverrideInput.safeParse({
    initiativeId: formData.get("initiativeId"),
    signal: String(formData.get("signal") ?? "").trim(),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "reason") return { ok: false, message: "Wpisz powód korekty (co najmniej 10 znaków)." };
    if (field === "signal") return { ok: false, message: "Sygnał to liczba od 0 do 100. Zostaw puste, żeby usunąć korektę." };
    return NOT_FOUND;
  }
  const { initiativeId: id, signal, reason } = parsed.data;
  const override = signal === "" ? null : signal;
  try {
    const supabase = createAdminClient();
    const before = await supabase.from("initiatives").select("signal, signal_override").eq("id", id).maybeSingle();
    if (before.error) throw before.error;
    if (!before.data) return NOT_FOUND;
    const { error } = await supabase.from("initiatives").update({ signal_override: override, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    await logChange(user.id, "initiative.signal_override", "initiative", id, {
      from: before.data.signal_override, to: override, radar: before.data.signal, reason: anonymize(reason).text,
    });
  } catch (e) {
    console.error("[panel] korekta sygnału:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: override == null ? "Usunięto korektę. Liczy się ocena radaru." : `Zapisano korektę: sygnał ${override}/100.` };
}

const CreatorConsentInput = z.object({
  initiativeId: z.uuid(),
  creatorId: z.uuid(),
  displayName: z.string().trim().max(120),
});

/**
 * Zgody twórcy po potwierdzeniu z nim (albo z opiekunem): wiek, zgoda opiekuna, podpis i pokazanie go publicznie.
 * Pola wyboru bez zaznaczenia nie trafiają do formularza, stąd odczyt przez `=== "on"`.
 */
export async function setCreatorConsent(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = CreatorConsentInput.safeParse({
    initiativeId: formData.get("initiativeId"), creatorId: formData.get("creatorId"), displayName: formData.get("displayName") ?? "",
  });
  if (!parsed.success) return { ok: false, message: "Podpis może mieć do 120 znaków." };
  const { initiativeId, creatorId } = parsed.data;
  const displayName = anonymize(parsed.data.displayName).text || null;
  const under18 = formData.get("under18") === "on";
  const guardianConsent = under18 && formData.get("guardianConsent") === "on";
  const showPublicly = formData.get("showPublicly") === "on";
  if (showPublicly && !displayName) return { ok: false, message: "Żeby pokazać podpis publicznie, wpisz go." };
  if (under18 && showPublicly && !guardianConsent) {
    return { ok: false, message: "Osobę poniżej 18 lat można pokazać tylko za zgodą opiekuna." };
  }
  try {
    const admin = createAdminClient();
    // Twórca musi należeć do tej inicjatywy — formularz nie może zmienić cudzego.
    const { data: link, error: linkError } = await admin
      .from("initiative_creators").select("creator_id").eq("initiative_id", initiativeId).eq("creator_id", creatorId).maybeSingle();
    if (linkError) throw linkError;
    if (!link) return NOT_FOUND;
    const { error } = await admin
      .from("creators")
      .update({ display_name: displayName, under_18: under18, guardian_consent: guardianConsent, show_publicly: showPublicly })
      .eq("id", creatorId);
    if (error) throw error;
    await logChange(user.id, "creator.consent", "initiative", initiativeId, { creatorId, under18, guardianConsent, showPublicly });
  } catch (e) {
    console.error("[panel] zgody twórcy:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: "Zapisano zgody twórcy." };
}

const ReplyInput = z.object({ id: z.uuid(), as: z.literal("staff"), body: z.string().trim().min(2).max(2000) });

/** Odpowiedź zespołu w rozmowie o inicjatywie. */
export async function replyInThread(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = ReplyInput.safeParse({ id: formData.get("id"), as: formData.get("as"), body: formData.get("body") });
  if (!parsed.success) return { ok: false, message: "Wpisz wiadomość (od 2 do 2000 znaków)." };
  const { id, as, body } = parsed.data;

  try {
    const thread = await initiativeThread({ id });
    if (!thread) return NOT_FOUND;
    if (thread.status === "archived") return { ok: false, message: "To zgłoszenie jest zamknięte. Najpierw zmień status." };
    await postStaffMessage(thread, {
      role: as,
      // Bez anonymize(): odpowiedź zespołu może celowo podawać telefon albo adres instytucji.
      body,
      actorId: user.id,
    });
  } catch (e) {
    console.error("[panel] rozmowa:", e);
    return { ok: false, message: "Nie udało się wysłać. Spróbuj ponownie." };
  }
  refresh();
  return { ok: true, message: "Wysłano. Autor zobaczy wiadomość w rozmowie." };
}

const IdInput = z.object({ initiativeId: z.uuid() });

/** Nadpisuje surową treść wersją zanonimizowaną (RODO: minimalizacja). Nie da się tego cofnąć. */
export async function removePersonalData(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = IdInput.safeParse({ initiativeId: formData.get("initiativeId") });
  if (!parsed.success) return NOT_FOUND;
  const id = parsed.data.initiativeId;
  try {
    const i = await loadInitiative(id);
    if (!i) return NOT_FOUND;
    const { text, found } = anonymize(i.raw_text ?? "");
    if (!found) return { ok: true, message: "W treści nie ma już danych, które umiemy rozpoznać." };
    const { error } = await createAdminClient().from("initiatives").update({ raw_text: text }).eq("id", id);
    if (error) throw error;
    await logChange(user.id, "initiative.remove_pii", "initiative", id, { field: "raw_text" });
  } catch (e) {
    console.error("[panel] dane osobowe:", e);
    return SAVE_FAILED;
  }
  refresh();
  return { ok: true, message: "Usunięto rozpoznane dane osobowe z treści." };
}

/**
 * Co usuwamy i co z tym sprzątamy. `kind` to rodzaj w search_index i threads, `payloadKey` — id w powiadomieniach.
 * Klucze obce (dopasowania, szkice wniosków) sprząta baza przez on delete cascade (0001_core.sql).
 */
const DELETABLE = {
  inicjatywa: { table: "initiatives", kind: "initiative", payloadKey: "initiativeId", list: "/panel" },
  program: { table: "programs", kind: "program", payloadKey: "programId", list: "/panel/programy" },
} as const;

const DeleteInput = z.object({ entity: z.enum(["inicjatywa", "program"]), id: z.uuid() });

/** Trwałe usunięcie inicjatywy albo programu razem z rozmową, wpisem w wyszukiwarce i powiadomieniami. */
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
    supabase.from("threads").delete().eq("entity_id", id).throwOnError(),
    supabase.from("search_index").delete().eq("kind", target.kind).eq("ref_id", id).throwOnError(),
    // Powiadomienia mają kopię opisu, więc znikają razem z rekordem.
    supabase.from("notifications").delete().eq(`payload->>${target.payloadKey}`, id).throwOnError(),
    logChange(user.id, `${target.kind}.delete`, target.kind, id, {}),
  ]);
  for (const r of followUp) if (r.status === "rejected") console.error(`[panel] sprzątanie po usunięciu ${entity} ${id}:`, r.reason);
  redirect(`${target.list}?usunieto=${entity}`);
}

/**
 * Włącznik programu. Przy otwarciu: autorzy pasujących inicjatyw z kontem dostają powiadomienie,
 * a autorzy bez konta, którzy zostawili e-mail — wiadomość.
 */
export async function setProgramActive(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";

  const supabase = createAdminClient();
  const { data: program, error } = await supabase.from("programs").update({ active }).eq("id", id).select("id, title").single();
  if (error) throw error;
  await Promise.all([
    supabase.from("search_index").update({ active }).eq("kind", "program").eq("ref_id", id),
    logChange(user.id, active ? "program.open" : "program.close", "program", id, { active }),
  ]);

  if (active) {
    try {
      const { data: indexed } = await supabase.from("search_index").select("lemmas").eq("kind", "program").eq("ref_id", id).maybeSingle();
      const lemmas = ((indexed?.lemmas as string | undefined) ?? program.title.toLowerCase()).split(/\s+/).filter(Boolean);
      const hits = (await keywordSearch("initiative", lemmas, 30)).filter((h) => h.similarity >= 0.25);
      if (hits.length) {
        const { data: rows } = await supabase
          .from("initiatives").select("id, author_id, contact_email").in("id", hits.map((h) => h.ref_id)).neq("status", "archived");
        const authors = [...new Set((rows ?? []).map((i) => i.author_id as string | null).filter((a): a is string => !!a))];
        if (authors.length) {
          await notify(authors.map((user_id) => ({ user_id, kind: "nowy_program", payload: { programId: program.id, title: program.title } })));
        }
        for (const row of (rows ?? []).filter((i) => i.contact_email)) {
          await emailAuthor(row.id as string, `Ruszył program „${program.title}”, możesz złożyć wniosek`);
        }
      }
    } catch (e) {
      console.error("[panel] powiadomienia o programie:", e);
    }
  }
  refresh();
}
