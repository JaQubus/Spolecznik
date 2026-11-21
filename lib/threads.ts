import "server-only";
import { emailAuthor } from "./author-contact";
import { keyMatches, rememberedInitiatives, rememberedKey } from "./initiatives/access";
import type { InitiativeStatus } from "./initiatives/status";
import { notify } from "./notifications";
import { logChange } from "./panel/initiatives";
import { createAdminClient } from "./supabase/admin";
import { firstLine, FORWARD_MESSAGES, type FirstLine } from "./first-line";
import {
  channelName, NEW_MESSAGE_EVENT, ROLE_LABELS,
  type AuthorRole, type MessageSource, type ThreadMessage, type ThreadWaiting,
} from "./thread-types";

/**
 * Rozmowa przypięta do inicjatywy: autor wchodzi po kodzie i tajnym kluczu, po drugiej stronie jest zespół
 * organizatora, przypisany mentor i asystent AI (pierwsza linia). Jeden kod otwiera dokładnie jedną rozmowę.
 */

export type InitiativeThread = {
  /** id inicjatywy. */
  id: string;
  code: string;
  title: string;
  status: InitiativeStatus;
  authorId: string | null;
  /** Skrót klucza do rozmowy (lib/initiatives/access.ts). Nigdy nie wysyłamy go do przeglądarki. */
  accessHash: string | null;
  threadId: string | null;
  /** Mentor: wybrany przez autora („Zapytaj mentora”) albo przypisany w Panelu (initiatives.assigned_mentor). */
  mentor: { id: string; name: string } | null;
  messages: ThreadMessage[];
  /** Czy rozmowa czeka na człowieka: asystent przekazał pytanie albo jego odpowiedź nie pomogła. */
  waiting: ThreadWaiting;
};

export async function mentorName(mentorId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("mentors").select("name").eq("id", mentorId).maybeSingle();
  if (error) throw error;
  return (data?.name as string | undefined) ?? null;
}

export async function loadMessages(threadId: string): Promise<ThreadMessage[]> {
  const { data, error } = await createAdminClient()
    .from("messages")
    .select("id, author_role, author_name, body, created_at, sources")
    .eq("thread_id", threadId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    role: m.author_role as AuthorRole,
    name: (m.author_name as string | null) ?? ROLE_LABELS[m.author_role as AuthorRole],
    body: m.body,
    createdAt: m.created_at,
    ...(m.sources ? { sources: m.sources as MessageSource[] } : {}),
  }));
}

const waitingOf = (t: { awaiting_human?: boolean | null; priority?: boolean | null } | null): ThreadWaiting =>
  t?.priority ? "pilne" : t?.awaiting_human ? "czlowiek" : null;

/** Rozmowy o inicjatywach, które czekają na człowieka: id inicjatywy → pilne albo zwykłe. Dla list w Panelu. */
export async function waitingThreads(entityIds?: string[]): Promise<Map<string, Exclude<ThreadWaiting, null>>> {
  let query = createAdminClient()
    .from("threads")
    .select("entity_id, awaiting_human, priority")
    .eq("entity_kind", "initiative")
    .eq("awaiting_human", true);
  if (entityIds) query = query.in("entity_id", entityIds);
  const { data, error } = await query;
  if (error) throw error;
  return new Map((data ?? []).map((t) => [t.entity_id as string, waitingOf(t)!]));
}

type InitiativeRow = {
  id: string; status_code: string; title: string; status: InitiativeStatus;
  author_id: string | null; access_hash: string | null; assigned_mentor: string | null;
};

/** Wątek inicjatywy po kodzie (autor) albo po id (Panel, mentor). Przed pokazaniem autorowi sprawdź klucz: canOpen(). */
export async function initiativeThread(by: { code: string } | { id: string }): Promise<InitiativeThread | null> {
  const supabase = createAdminClient();
  const query = supabase.from("initiatives").select("id, status_code, title, status, author_id, access_hash, assigned_mentor");
  const { data: row, error: rowError } = await ("code" in by ? query.eq("status_code", by.code) : query.eq("id", by.id)).maybeSingle<InitiativeRow>();
  if (rowError) throw rowError;
  if (!row) return null;

  const { data: thread, error } = await supabase
    .from("threads")
    .select("id, mentor_id, awaiting_human, priority")
    .eq("entity_kind", "initiative")
    .eq("entity_id", row.id)
    .maybeSingle();
  if (error) throw error;

  const mentorId = row.assigned_mentor ?? (thread?.mentor_id as string | null) ?? null;
  const [name, messages] = await Promise.all([
    mentorId ? mentorName(mentorId) : null,
    thread ? loadMessages(thread.id) : [],
  ]);
  return {
    id: row.id,
    code: row.status_code,
    title: row.title,
    status: row.status,
    authorId: row.author_id,
    accessHash: row.access_hash,
    threadId: thread?.id ?? null,
    mentor: mentorId && name ? { id: mentorId, name } : null,
    messages,
    waiting: waitingOf(thread),
  };
}

/** Czy ta przeglądarka ma klucz do rozmowy (ciasteczko z wysłania zgłoszenia albo z prywatnego linku). */
export async function canOpen(t: InitiativeThread): Promise<boolean> {
  return keyMatches(t.accessHash, await rememberedKey(t.code));
}

/** Ta sama odpowiedź dla braku zgłoszenia i braku klucza, żeby po odpowiedzi nie dało się sprawdzać, które kody istnieją. */
export const THREAD_NOT_FOUND =
  "Nie znaleźliśmy zgłoszenia o tym kodzie. Ta rozmowa jest prywatna. Otwórz ją na urządzeniu, z którego wysłano zgłoszenie, albo prywatnym linkiem";

/** Wątek tylko dla przeglądarki z kluczem (ciasteczko httpOnly, lib/initiatives/access.ts); inaczej null. */
export async function authorizedThread(code: string): Promise<InitiativeThread | null> {
  const thread = await initiativeThread({ code });
  return thread && (await canOpen(thread)) ? thread : null;
}

/** Tylko to, co widzi autor: bez id inicjatywy, id autora i skrótu klucza. */
export function authorView(t: InitiativeThread) {
  return { threadId: t.threadId, status: t.status, mentor: t.mentor, messages: t.messages, waiting: t.waiting };
}

/**
 * Inicjatywa z listy „Twoje zgłoszenia na tym urządzeniu”.
 */
export type MyInitiative = { code: string; status: InitiativeStatus; title: string; createdAt: string };

/** „Twoje zgłoszenia na tym urządzeniu”: pary kod–klucz z ciasteczka, sprawdzone z bazą, najnowsze pierwsze. */
export async function rememberedThreads(): Promise<MyInitiative[]> {
  const remembered = await rememberedInitiatives();
  if (remembered.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("initiatives")
    .select("id, status_code, status, title, created_at, access_hash")
    .in("status_code", remembered.map((r) => r.code));
  if (error) throw error;

  const mine = remembered.flatMap(({ code, key }) => {
    const row = (data ?? []).find((r) => r.status_code === code && keyMatches(r.access_hash as string | null, key));
    return row ? [row] : [];
  });

  return mine.map((r) => ({
    code: r.status_code as string,
    status: r.status as InitiativeStatus,
    title: r.title as string,
    createdAt: r.created_at as string,
  }));
}

/** Czy para kod–klucz (prywatny link, ciasteczko) otwiera inicjatywę. */
export async function keyOpens(code: string, key: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("initiatives").select("access_hash").eq("status_code", code).maybeSingle();
  if (error) throw error;
  return keyMatches((data?.access_hash as string | null) ?? null, key);
}

/** Zakłada wątek przy pierwszej wiadomości. */
export async function ensureThread(t: InitiativeThread): Promise<string> {
  const supabase = createAdminClient();
  if (t.threadId) return t.threadId;
  const { data, error } = await supabase
    .from("threads")
    .upsert(
      { entity_kind: "initiative", entity_id: t.id, title: `Inicjatywa ${t.code}` },
      { onConflict: "entity_kind,entity_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Sygnał „jest nowa wiadomość” bez treści — klient sam pobiera wątek przez API (po kodzie albo w Panelu). */
export async function nudge(threadId: string) {
  const supabase = createAdminClient();
  const channel = supabase.channel(channelName(threadId));
  try {
    const res = await channel.httpSend(NEW_MESSAGE_EVENT, {});
    if (!res.success) console.error("[rozmowy] broadcast:", res.error);
  } catch (e) {
    console.error("[rozmowy] broadcast:", e);
  } finally {
    await supabase.removeChannel(channel);
  }
}

/** Zmiana statusu inicjatywy ze śladem w audit_log (oś czasu na /status/[kod]). */
export async function setInitiativeStatus(
  t: Pick<InitiativeThread, "id" | "status">,
  to: InitiativeStatus,
  actorId: string | null,
  diffExtra: Record<string, unknown> = {},
) {
  const { error } = await createAdminClient()
    .from("initiatives")
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq("id", t.id);
  if (error) throw error;
  await logChange(actorId, "initiative.status", "initiative", t.id, { from: t.status, to, ...diffExtra });
}

/** Payload powiadomień o rozmowie: id inicjatywy i kod, żeby dzwonek linkował do właściwej karty. */
export function threadPayload(t: Pick<InitiativeThread, "id" | "code">, extra: Record<string, unknown> = {}) {
  return { initiativeId: t.id, code: t.code, ...extra };
}

type NewMessage = { role: AuthorRole; name?: string; body: string; actorId?: string | null; sources?: MessageSource[] };

/** Zapis jednej wiadomości. `thread` — dodatkowe pola wątku (awaiting_human, priority) zmieniane razem z updated_at. */
async function insertMessage(threadId: string, msg: NewMessage, thread: Record<string, unknown> = {}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    author_id: msg.actorId ?? null,
    author_role: msg.role,
    author_name: msg.name ?? ROLE_LABELS[msg.role],
    body: msg.body,
    ...(msg.sources ? { sources: msg.sources } : {}),
  });
  if (error) throw error;
  const { error: uError } = await supabase
    .from("threads")
    .update({ updated_at: new Date().toISOString(), ...thread })
    .eq("id", threadId);
  if (uError) console.error("[rozmowy] wątek:", uError);
}

/**
 * Odpowiedź zespołu: powiadomienie i e-mail do autora, a rozmowa przestaje czekać na człowieka.
 * Pierwsza odpowiedź przesuwa świeże zgłoszenie na „W analizie”. `actorId` to admin piszący z Panelu
 * (null przy koncie testowym).
 */
export async function postStaffMessage(
  t: InitiativeThread,
  msg: { role: "staff" | "mentor"; name?: string; body: string; actorId?: string | null },
): Promise<string> {
  const threadId = await ensureThread(t);
  await insertMessage(threadId, msg, { awaiting_human: false, priority: false });

  if (t.authorId) {
    await notify({ user_id: t.authorId, kind: "nowa_wiadomosc", payload: threadPayload(t, { threadId }) })
      .catch((e) => console.error("[rozmowy] powiadomienie:", e));
  }
  await emailAuthor(t.id, "Masz nową odpowiedź w rozmowie");

  if (t.status === "submitted") {
    await setInitiativeStatus(t, "in_review", msg.actorId ?? null, { note: `Odpowiedź w rozmowie od: ${msg.name ?? ROLE_LABELS[msg.role]}` });
  }

  await nudge(threadId);
  return threadId;
}

/** Co zrobił asystent z wiadomością autora — trafia do dzwonka admina. null: asystent nie działał (limit zapytań). */
export type AssistantOutcome = FirstLine["outcome"] | null;

/**
 * Wiadomość autora i pierwsza linia: asystent odpowiada z bazy wiedzy ze źródłami albo przekazuje pytanie
 * człowiekowi. Odpowiedź asystenta nie zmienia statusu i nie wysyła e-maila — autor jest na stronie.
 * `body` jest już zanonimizowane. `assistant` = false, gdy autor przekroczył limit zapytań do AI.
 */
export async function postAuthorMessage(
  t: InitiativeThread,
  body: string,
  { assistant }: { assistant: boolean },
): Promise<{ threadId: string; ai: AssistantOutcome }> {
  const threadId = await ensureThread(t);
  await insertMessage(threadId, { role: "author", body });
  // Sygnał od razu: Panel i druga karta autora widzą wiadomość, zanim asystent skończy.
  await nudge(threadId);

  const ai = assistant ? await firstLine(body) : null;
  // Na człowieka czeka wszystko, czego asystent nie obsłużył; podziękowanie czy uzupełnienie opisu — nie.
  const forHuman = ai === null || ai.outcome === "przekazano";
  // „Przekazałem” piszemy raz: nie, gdy rozmowa już czeka albo gdy zespół lub mentor już w niej odpisali.
  const humanInThread = t.messages.some((m) => m.role === "staff" || m.role === "mentor");
  const reply: NewMessage | null =
    ai?.outcome === "odpowiedz"
      ? { role: "ai", body: ai.body, sources: ai.sources }
      : ai?.outcome === "przekazano" && !t.waiting && !humanInThread
        ? { role: "ai", body: FORWARD_MESSAGES[ai.reason] }
        : null;

  const waiting = forHuman ? { awaiting_human: true } : {};
  if (reply) {
    await insertMessage(threadId, reply, waiting);
  } else if (forHuman) {
    const { error } = await createAdminClient().from("threads").update(waiting).eq("id", threadId);
    if (error) console.error("[rozmowy] wątek:", error);
  }

  await notify({ role: "admin", kind: "nowa_wiadomosc", payload: threadPayload(t, { threadId, ai: ai?.outcome ?? null }) })
    .catch((e) => console.error("[rozmowy] powiadomienie:", e));
  if (reply) await nudge(threadId);
  return { threadId, ai: ai?.outcome ?? null };
}

/**
 * „To nie odpowiada na moje pytanie”: rozmowa wraca do człowieka jako pilna. Tylko gdy w wątku jest odpowiedź
 * asystenta ze źródłami; ponowne kliknięcie niczego nie zmienia. Zwraca false, gdy nie było czego oznaczać.
 */
export async function markNotHelpful(t: InitiativeThread): Promise<boolean> {
  const answered = t.messages.some((m) => m.role === "ai" && m.sources?.length);
  if (!t.threadId || !answered) return false;
  if (t.waiting === "pilne") return true;
  const { error } = await createAdminClient()
    .from("threads")
    .update({ awaiting_human: true, priority: true, updated_at: new Date().toISOString() })
    .eq("id", t.threadId);
  if (error) throw error;
  await notify({ role: "admin", kind: "pilne_pytanie", payload: threadPayload(t, { threadId: t.threadId }) })
    .catch((e) => console.error("[rozmowy] powiadomienie:", e));
  await nudge(t.threadId);
  return true;
}
