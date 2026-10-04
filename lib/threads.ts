import "server-only";
import { keyMatches, rememberedKey, rememberedNeeds } from "./need-access";
import type { NeedStatus } from "./need-status";
import { logChange } from "./panel/needs";
import { createAdminClient } from "./supabase/admin";
import { channelName, NEW_MESSAGE_EVENT, ROLE_LABELS, type AuthorRole, type ThreadMessage } from "./thread-types";

/** Społecznik·Rozmowy: wątek przypięty do karty (README §6). Na razie karty potrzeb — autor wchodzi po kodzie SPL-…. */

export type NeedThread = {
  needId: string;
  code: string;
  status: NeedStatus;
  authorId: string | null;
  /** Skrót klucza do rozmowy (lib/need-access.ts). Nigdy nie wysyłamy go do przeglądarki. */
  accessHash: string | null;
  threadId: string | null;
  /** Ekspert wątku: wybrany przez autora („Zapytaj eksperta”) albo przypisany w Panelu. */
  expert: { id: string; name: string } | null;
  messages: ThreadMessage[];
};

/** Statusy, z których odpowiedź ROPS albo eksperta przesuwa zgłoszenie na „Odpowiedź”. */
const BEFORE_ANSWER: NeedStatus[] = ["zgloszone", "w_analizie", "ekspert"];

export async function expertName(expertId: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("search_index")
    .select("title")
    .eq("kind", "ekspert")
    .eq("ref_id", expertId)
    .maybeSingle();
  if (error) throw error;
  return (data?.title as string | undefined) ?? null;
}

async function loadMessages(threadId: string): Promise<ThreadMessage[]> {
  const { data, error } = await createAdminClient()
    .from("messages")
    .select("id, author_role, author_name, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    role: m.author_role as AuthorRole,
    name: (m.author_name as string | null) ?? ROLE_LABELS[m.author_role as AuthorRole],
    body: m.body,
    createdAt: m.created_at,
  }));
}

/** Wątek zgłoszenia po kodzie albo po id (Panel). Przed pokazaniem autorowi sprawdź klucz: canOpen(). */
export async function needThread(by: { code: string } | { needId: string }): Promise<NeedThread | null> {
  const supabase = createAdminClient();
  const query = supabase.from("needs").select("id, status_code, status, author_id, access_hash, assigned_expert");
  const { data: need, error } = await ("code" in by ? query.eq("status_code", by.code) : query.eq("id", by.needId)).maybeSingle();
  if (error) throw error;
  if (!need) return null;

  const { data: thread, error: tError } = await supabase
    .from("threads")
    .select("id, expert_id")
    .eq("entity_kind", "potrzeba")
    .eq("entity_id", need.id)
    .maybeSingle();
  if (tError) throw tError;

  const expertId = (need.assigned_expert as string | null) ?? (thread?.expert_id as string | null) ?? null;
  const [name, messages] = await Promise.all([
    expertId ? expertName(expertId) : null,
    thread ? loadMessages(thread.id) : [],
  ]);
  return {
    needId: need.id,
    code: need.status_code,
    status: need.status,
    authorId: need.author_id,
    accessHash: need.access_hash,
    threadId: thread?.id ?? null,
    expert: expertId && name ? { id: expertId, name } : null,
    messages,
  };
}

/** Czy ta przeglądarka ma klucz do rozmowy (ciasteczko z wysłania zgłoszenia albo z prywatnego linku). */
export async function canOpen(t: NeedThread): Promise<boolean> {
  return keyMatches(t.accessHash, await rememberedKey(t.code));
}

export type MyNeed = { code: string; status: NeedStatus; summary: string; createdAt: string };

/** „Twoje zgłoszenia na tym urządzeniu”: pary kod–klucz z ciasteczka, sprawdzone z bazą, najnowsze pierwsze. */
export async function rememberedThreads(): Promise<MyNeed[]> {
  const remembered = await rememberedNeeds();
  if (remembered.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("needs")
    .select("status_code, status, card, created_at, access_hash")
    .in("status_code", remembered.map((r) => r.code));
  if (error) throw error;
  const byCode = new Map((data ?? []).map((n) => [n.status_code as string, n]));
  return remembered.flatMap(({ code, key }) => {
    const n = byCode.get(code);
    if (!n || !keyMatches(n.access_hash, key)) return [];
    return [{ code, status: n.status, summary: (n.card as { summary?: string }).summary ?? "", createdAt: n.created_at }];
  });
}

/** Zakłada wątek przy pierwszej wiadomości. Ekspert wybrany przez autora zostaje zapamiętany w wątku. */
async function ensureThread(t: NeedThread, expertId: string | null): Promise<string> {
  const supabase = createAdminClient();
  if (t.threadId) {
    if (expertId && !t.expert) {
      const { error } = await supabase.from("threads").update({ expert_id: expertId }).eq("id", t.threadId);
      if (error) throw error;
    }
    return t.threadId;
  }
  const { data, error } = await supabase
    .from("threads")
    .upsert(
      { entity_kind: "potrzeba", entity_id: t.needId, title: `Zgłoszenie ${t.code}`, expert_id: expertId },
      { onConflict: "entity_kind,entity_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Sygnał „jest nowa wiadomość” bez treści — klient sam pobiera wątek przez API (po kodzie albo w Panelu). */
async function nudge(threadId: string) {
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

/**
 * Zapis wiadomości + powiadomienia: od autora → dzwonek admina; od ROPS albo eksperta → autor (jeśli ma konto)
 * i status „Odpowiedź” na osi czasu. Odpowiedź AI (pierwsza linia) nie jest odpowiedzią człowieka: bez powiadomień
 * i bez zmiany statusu. `actorId` to admin piszący z Panelu (null przy koncie testowym).
 */
export async function postNeedMessage(
  t: NeedThread,
  msg: { role: AuthorRole; name?: string; body: string; actorId?: string | null; expertId?: string | null },
): Promise<string> {
  const supabase = createAdminClient();
  const threadId = await ensureThread(t, msg.expertId ?? null);
  const now = new Date().toISOString();

  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    author_id: msg.actorId ?? null,
    author_role: msg.role,
    author_name: msg.name ?? ROLE_LABELS[msg.role],
    body: msg.body,
  });
  if (error) throw error;
  const { error: uError } = await supabase.from("threads").update({ updated_at: now }).eq("id", threadId);
  if (uError) console.error("[rozmowy] updated_at:", uError);

  const fromAuthor = msg.role === "autor";
  const fromHuman = msg.role === "rops" || msg.role === "ekspert";
  const payload = { needId: t.needId, code: t.code, threadId };
  const notify = fromAuthor
    ? supabase.from("notifications").insert({ role: "admin", kind: "nowa_wiadomosc", payload })
    : fromHuman && t.authorId
      ? supabase.from("notifications").insert({ user_id: t.authorId, kind: "nowa_wiadomosc", payload })
      : null;
  if (notify) {
    const { error: nError } = await notify;
    if (nError) console.error("[rozmowy] powiadomienie:", nError);
  }

  if (fromHuman && BEFORE_ANSWER.includes(t.status)) {
    const { error: sError } = await supabase.from("needs").update({ status: "odpowiedz", updated_at: now }).eq("id", t.needId);
    if (sError) throw sError;
    await logChange(msg.actorId ?? null, "need.status", "need", t.needId, {
      from: t.status,
      to: "odpowiedz",
      note: `Odpowiedź w rozmowie od: ${msg.name ?? ROLE_LABELS[msg.role]}`,
    });
  }

  await nudge(threadId);
  return threadId;
}
