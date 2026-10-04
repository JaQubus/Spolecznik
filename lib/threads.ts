import "server-only";
import { emailAuthor } from "./author-contact";
import { keyMatches, rememberedKey, rememberedNeeds } from "./need-access";
import type { NeedStatus } from "./need-status";
import { notify } from "./notifications";
import { logChange } from "./panel/needs";
import { createAdminClient } from "./supabase/admin";
import { firstLine, FORWARD_MESSAGES, type FirstLine } from "./first-line";
import {
  channelName, NEW_MESSAGE_EVENT, ROLE_LABELS,
  type AuthorRole, type MessageSource, type ThreadMessage, type ThreadWaiting,
} from "./thread-types";

/**
 * Społecznik·Rozmowy: wątek przypięty do karty (README §6). Karty potrzeb i pomysłów — autor wchodzi po kodzie SPL-…
 * (kody są wspólne dla obu tabel, 0015_status_code_shared.sql), więc jeden kod otwiera dokładnie jedną rozmowę.
 */

export type ReportKind = "potrzeba" | "pomysl";

/** Tabela, wpis w audit_log i klucz id w powiadomieniach — dla każdego rodzaju zgłoszenia. */
const REPORTS = {
  potrzeba: { table: "needs", entity: "need", payloadKey: "needId", label: "Zgłoszenie" },
  pomysl: { table: "ideas", entity: "idea", payloadKey: "ideaId", label: "Pomysł" },
} as const;

export type NeedThread = {
  kind: ReportKind;
  /** id potrzeby albo pomysłu. */
  id: string;
  code: string;
  status: NeedStatus;
  authorId: string | null;
  /** Skrót klucza do rozmowy (lib/need-access.ts). Nigdy nie wysyłamy go do przeglądarki. */
  accessHash: string | null;
  threadId: string | null;
  /**
   * Ekspert wątku: wybrany przez autora („Zapytaj eksperta”) albo przypisany w Panelu.
   * Potrzeby trzymają przypisanego w needs.assigned_expert, pomysły — w threads.expert_id.
   */
  expert: { id: string; name: string } | null;
  messages: ThreadMessage[];
  /** Czy rozmowa czeka na człowieka (migracja 0019): asystent przekazał pytanie albo jego odpowiedź nie pomogła. */
  waiting: ThreadWaiting;
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

/** Rozmowy danego rodzaju, które czekają na człowieka: id karty → pilne albo zwykłe. Dla list w Panelu. */
export async function waitingThreads(kind: ReportKind, entityIds?: string[]): Promise<Map<string, Exclude<ThreadWaiting, null>>> {
  let query = createAdminClient()
    .from("threads")
    .select("entity_id, awaiting_human, priority")
    .eq("entity_kind", kind)
    .eq("awaiting_human", true);
  if (entityIds) query = query.in("entity_id", entityIds);
  const { data, error } = await query;
  if (error) throw error;
  return new Map((data ?? []).map((t) => [t.entity_id as string, waitingOf(t)!]));
}

type ReportRow = { id: string; status_code: string; status: NeedStatus; author_id: string | null; access_hash: string | null; assigned_expert?: string | null };

async function findReport(by: { code: string } | { kind: ReportKind; id: string }): Promise<{ kind: ReportKind; row: ReportRow } | null> {
  const supabase = createAdminClient();
  const kinds: ReportKind[] = "kind" in by ? [by.kind] : ["potrzeba", "pomysl"];
  for (const kind of kinds) {
    const columns = `id, status_code, status, author_id, access_hash${kind === "potrzeba" ? ", assigned_expert" : ""}`;
    const query = supabase.from(REPORTS[kind].table).select(columns);
    const { data, error } = await ("code" in by ? query.eq("status_code", by.code) : query.eq("id", by.id)).maybeSingle();
    if (error) throw error;
    if (data) return { kind, row: data as unknown as ReportRow };
  }
  return null;
}

/** Wątek zgłoszenia albo pomysłu po kodzie (autor) albo po id (Panel). Przed pokazaniem autorowi sprawdź klucz: canOpen(). */
export async function needThread(by: { code: string } | { kind: ReportKind; id: string }): Promise<NeedThread | null> {
  const found = await findReport(by);
  if (!found) return null;
  const { kind, row } = found;

  const { data: thread, error } = await createAdminClient()
    .from("threads")
    .select("id, expert_id, awaiting_human, priority")
    .eq("entity_kind", kind)
    .eq("entity_id", row.id)
    .maybeSingle();
  if (error) throw error;

  const expertId = row.assigned_expert ?? (thread?.expert_id as string | null) ?? null;
  const [name, messages] = await Promise.all([
    expertId ? expertName(expertId) : null,
    thread ? loadMessages(thread.id) : [],
  ]);
  return {
    kind,
    id: row.id,
    code: row.status_code,
    status: row.status,
    authorId: row.author_id,
    accessHash: row.access_hash,
    threadId: thread?.id ?? null,
    expert: expertId && name ? { id: expertId, name } : null,
    messages,
    waiting: waitingOf(thread),
  };
}

/** Czy ta przeglądarka ma klucz do rozmowy (ciasteczko z wysłania zgłoszenia albo z prywatnego linku). */
export async function canOpen(t: NeedThread): Promise<boolean> {
  return keyMatches(t.accessHash, await rememberedKey(t.code));
}

/** Ta sama odpowiedź dla braku zgłoszenia i braku klucza, żeby po odpowiedzi nie dało się sprawdzać, które kody istnieją. */
export const THREAD_NOT_FOUND =
  "Nie znaleźliśmy zgłoszenia o tym kodzie. Ta rozmowa jest prywatna. Otwórz ją na urządzeniu, z którego wysłano zgłoszenie, albo prywatnym linkiem";

/** Wątek tylko dla przeglądarki z kluczem (ciasteczko httpOnly, lib/need-access.ts); inaczej null. */
export async function authorizedThread(code: string): Promise<NeedThread | null> {
  const thread = await needThread({ code });
  return thread && (await canOpen(thread)) ? thread : null;
}

/** Tylko to, co widzi autor: bez id zgłoszenia, id autora i skrótu klucza. */
export function authorView(t: NeedThread) {
  return { threadId: t.threadId, status: t.status, expert: t.expert, messages: t.messages, waiting: t.waiting };
}

/**
 * Zgłoszenie z listy „Twoje zgłoszenia na tym urządzeniu”. Potrzeba i pomysł mają rozmowę i status.
 * `invitations`: zaproszenia do partnerstwa gmin bez odpowiedzi (tylko potrzeby, lib/partnerships.ts).
 */
export type MyNeed = { kind: ReportKind; code: string; status: NeedStatus; summary: string; createdAt: string; invitations: number };

/** „Twoje zgłoszenia na tym urządzeniu”: pary kod–klucz z ciasteczka, sprawdzone z bazą, najnowsze pierwsze. */
export async function rememberedThreads(): Promise<MyNeed[]> {
  const remembered = await rememberedNeeds();
  if (remembered.length === 0) return [];
  const codes = remembered.map((r) => r.code);
  const supabase = createAdminClient();
  const [needs, ideas] = await Promise.all([
    supabase.from("needs").select("id, status_code, status, card, created_at, access_hash").in("status_code", codes),
    supabase.from("ideas").select("status_code, status, fiszka, created_at, access_hash").in("status_code", codes),
  ]);
  if (needs.error) throw needs.error;
  if (ideas.error) throw ideas.error;

  const rows = [
    ...(needs.data ?? []).map((n) => ({
      hash: n.access_hash as string | null,
      needId: n.id as string,
      mine: { kind: "potrzeba", code: n.status_code, status: n.status, summary: (n.card as { summary?: string }).summary ?? "", createdAt: n.created_at, invitations: 0 } satisfies MyNeed,
    })),
    ...(ideas.data ?? []).map((i) => ({
      hash: i.access_hash as string | null,
      needId: null,
      mine: { kind: "pomysl", code: i.status_code, status: i.status, summary: (i.fiszka as { krotki_opis?: string }).krotki_opis ?? "", createdAt: i.created_at, invitations: 0 } satisfies MyNeed,
    })),
  ];
  // Kody są unikalne w obrębie tabeli; gdyby potrzeba i pomysł miały ten sam, rozstrzyga klucz.
  const mine = remembered.flatMap(({ code, key }) => {
    const row = rows.find((r) => r.mine.code === code && keyMatches(r.hash, key));
    return row ? [row] : [];
  });

  // Bez migracji 0023 lista ma działać dalej, tylko bez zaproszeń.
  const needIds = mine.flatMap((r) => (r.needId ? [r.needId] : []));
  const invitations = new Map<string, number>();
  const { data: invited, error: iError } = needIds.length
    ? await supabase.from("thread_participants").select("need_id").in("need_id", needIds).eq("status", "zaproszone")
    : { data: [], error: null };
  if (iError) console.error("[rozmowy] zaproszenia:", iError);
  for (const r of invited ?? []) invitations.set(r.need_id as string, (invitations.get(r.need_id as string) ?? 0) + 1);

  return mine.map((r) => ({ ...r.mine, invitations: r.needId ? invitations.get(r.needId) ?? 0 : 0 }));
}

/** Co otwiera para kod–klucz (prywatny link, ciasteczko): potrzebę albo pomysł. null, gdy klucz nie pasuje. */
export async function reportForKey(code: string, key: string): Promise<ReportKind | null> {
  const supabase = createAdminClient();
  const [need, idea] = await Promise.all([
    supabase.from("needs").select("access_hash").eq("status_code", code).maybeSingle(),
    supabase.from("ideas").select("access_hash").eq("status_code", code).maybeSingle(),
  ]);
  if (need.error) throw need.error;
  if (idea.error) throw idea.error;
  if (keyMatches(need.data?.access_hash ?? null, key)) return "potrzeba";
  if (keyMatches(idea.data?.access_hash ?? null, key)) return "pomysl";
  return null;
}

/**
 * Zakłada wątek przy pierwszej wiadomości (albo przy przypisaniu eksperta do pomysłu).
 * `expertId` zapisujemy, gdy wątek nie ma jeszcze eksperta; `replaceExpert` — przypisanie w Panelu, które go zmienia.
 */
export async function ensureThread(t: NeedThread, expertId: string | null, replaceExpert = false): Promise<string> {
  const supabase = createAdminClient();
  if (t.threadId) {
    if (expertId && (replaceExpert || !t.expert)) {
      const { error } = await supabase.from("threads").update({ expert_id: expertId }).eq("id", t.threadId);
      if (error) throw error;
    }
    return t.threadId;
  }
  const { data, error } = await supabase
    .from("threads")
    .upsert(
      { entity_kind: t.kind, entity_id: t.id, title: `${REPORTS[t.kind].label} ${t.code}`, expert_id: expertId },
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

/** Zmiana statusu zgłoszenia albo pomysłu ze śladem w audit_log (oś czasu na /status/[kod]). Pomysły nie mają updated_at. */
export async function setReportStatus(
  t: Pick<NeedThread, "kind" | "id" | "status">,
  to: NeedStatus,
  actorId: string | null,
  action: string,
  diffExtra: Record<string, unknown> = {},
) {
  const { table, entity } = REPORTS[t.kind];
  const patch = t.kind === "potrzeba" ? { status: to, updated_at: new Date().toISOString() } : { status: to };
  const { error } = await createAdminClient().from(table).update(patch).eq("id", t.id);
  if (error) throw error;
  await logChange(actorId, action, entity, t.id, { from: t.status, to, ...diffExtra });
}

/** Payload powiadomień o rozmowie: id pod kluczem rodzaju (needId / ideaId), żeby dzwonek linkował do właściwej karty w Panelu. */
export function threadPayload(t: Pick<NeedThread, "kind" | "id" | "code">, extra: Record<string, unknown> = {}) {
  return { [REPORTS[t.kind].payloadKey]: t.id, code: t.code, ...extra };
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
 * Odpowiedź ROPS albo eksperta: powiadomienie i e-mail do autora, status „Odpowiedź” na osi czasu,
 * a rozmowa przestaje czekać na człowieka. `actorId` to admin piszący z Panelu (null przy koncie testowym).
 */
export async function postNeedMessage(
  t: NeedThread,
  msg: { role: "rops" | "ekspert"; name?: string; body: string; actorId?: string | null },
): Promise<string> {
  const threadId = await ensureThread(t, null);
  await insertMessage(threadId, msg, { awaiting_human: false, priority: false });

  if (t.authorId) {
    await notify({ user_id: t.authorId, kind: "nowa_wiadomosc", payload: threadPayload(t, { threadId }) })
      .catch((e) => console.error("[rozmowy] powiadomienie:", e));
  }
  await emailAuthor(t.kind, t.id, "Masz nową odpowiedź w rozmowie");

  if (BEFORE_ANSWER.includes(t.status)) {
    await setReportStatus(t, "odpowiedz", msg.actorId ?? null, `${REPORTS[t.kind].entity}.status`, {
      note: `Odpowiedź w rozmowie od: ${msg.name ?? ROLE_LABELS[msg.role]}`,
    });
  }

  await nudge(threadId);
  return threadId;
}

/** Co zrobił asystent z wiadomością autora — trafia do dzwonka admina. null: asystent nie działał (limit zapytań). */
export type AssistantOutcome = FirstLine["outcome"] | null;

/**
 * Wiadomość autora i pierwsza linia „Zapytaj ROPS” (#20): asystent odpowiada z Zasobnika ze źródłami albo przekazuje
 * pytanie człowiekowi. Odpowiedź asystenta nie zmienia statusu zgłoszenia i nie wysyła e-maila — autor jest na stronie.
 * `body` jest już zanonimizowane. `assistant` = false, gdy autor przekroczył limit zapytań do AI.
 */
export async function postAuthorMessage(
  t: NeedThread,
  body: string,
  { expertId, assistant }: { expertId: string | null; assistant: boolean },
): Promise<{ threadId: string; ai: AssistantOutcome }> {
  const threadId = await ensureThread(t, expertId);
  await insertMessage(threadId, { role: "autor", body });
  // Sygnał od razu: Panel i druga karta autora widzą wiadomość, zanim asystent skończy.
  await nudge(threadId);

  const ai = assistant ? await firstLine(body) : null;
  // Na człowieka czeka wszystko, czego asystent nie obsłużył; podziękowanie czy uzupełnienie opisu — nie.
  const forHuman = ai === null || ai.outcome === "przekazano";
  // „Przekazałem” piszemy raz: nie, gdy rozmowa już czeka albo gdy ROPS lub ekspert już w niej odpisali.
  const humanInThread = t.messages.some((m) => m.role === "rops" || m.role === "ekspert");
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
export async function markNotHelpful(t: NeedThread): Promise<boolean> {
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
