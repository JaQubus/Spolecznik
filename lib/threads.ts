import "server-only";
import { keyMatches, rememberedKey, rememberedNeeds } from "./need-access";
import type { NeedStatus } from "./need-status";
import { notify } from "./notifications";
import { logChange } from "./panel/needs";
import { createAdminClient } from "./supabase/admin";
import { channelName, NEW_MESSAGE_EVENT, ROLE_LABELS, type AuthorRole, type ThreadMessage } from "./thread-types";

/**
 * Społecznik·Rozmowy: wątek przypięty do zgłoszenia (README §6) — problemu z „Opisz problem” albo pomysłu z Pracowni.
 * Autor wchodzi po kodzie SPL-… i kluczu z przeglądarki; potrzeby i pomysły dzielą jedną przestrzeń kodów (0015).
 */

export type ReportKind = "potrzeba" | "pomysl";

export type ReportThread = {
  kind: ReportKind;
  /** id w needs albo ideas — nigdy nie wysyłamy go autorowi. */
  reportId: string;
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

/**
 * Skąd czytamy zgłoszenie i jak je podpisujemy w audit_log i powiadomieniach (`payloadKey` sprząta je przy usuwaniu).
 * Pomysł nie ma kolumny z ekspertem ani updated_at — eksperta trzyma jego wątek (threads.expert_id).
 */
const REPORTS = {
  potrzeba: { table: "needs", audit: "need", payloadKey: "needId", title: "Zgłoszenie", columns: "id, status_code, status, author_id, access_hash, assigned_expert" },
  pomysl: { table: "ideas", audit: "idea", payloadKey: "ideaId", title: "Pomysł", columns: "id, status_code, status, author_id, access_hash" },
} as const;

type ReportRow = {
  id: string;
  status_code: string;
  status: NeedStatus;
  author_id: string | null;
  access_hash: string | null;
  assigned_expert?: string | null;
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

/** Po kodzie szukamy w obu tabelach naraz (kody są wspólne); po id — w tabeli podanego rodzaju. */
async function findReport(by: { code: string } | { kind: ReportKind; id: string }): Promise<{ kind: ReportKind; row: ReportRow } | null> {
  const supabase = createAdminClient();
  const kinds: ReportKind[] = "code" in by ? ["potrzeba", "pomysl"] : [by.kind];
  const results = await Promise.all(
    kinds.map((kind) => {
      const query = supabase.from(REPORTS[kind].table).select(REPORTS[kind].columns);
      return ("code" in by ? query.eq("status_code", by.code) : query.eq("id", by.id)).maybeSingle();
    }),
  );
  for (const [i, { data, error }] of results.entries()) {
    if (error) throw error;
    if (data) return { kind: kinds[i], row: data as unknown as ReportRow };
  }
  return null;
}

/** Wątek zgłoszenia albo pomysłu: po kodzie (autor) albo po rodzaju i id (Panel). Przed pokazaniem autorowi sprawdź klucz: canOpen(). */
export async function reportThread(by: { code: string } | { kind: ReportKind; id: string }): Promise<ReportThread | null> {
  const found = await findReport(by);
  if (!found) return null;
  const { kind, row } = found;

  const { data: thread, error } = await createAdminClient()
    .from("threads")
    .select("id, expert_id")
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
    reportId: row.id,
    code: row.status_code,
    status: row.status,
    authorId: row.author_id,
    accessHash: row.access_hash,
    threadId: thread?.id ?? null,
    expert: expertId && name ? { id: expertId, name } : null,
    messages,
  };
}

/** Czy ta przeglądarka ma klucz do rozmowy (ciasteczko z wysłania zgłoszenia albo z prywatnego linku). */
export async function canOpen(t: ReportThread): Promise<boolean> {
  return keyMatches(t.accessHash, await rememberedKey(t.code));
}

/** Zgłoszenie zapamiętane w tej przeglądarce. Problem i pomysł mają rozmowę i status. */
export type MyNeed = { kind: ReportKind; code: string; status: NeedStatus; summary: string; createdAt: string };

/** „Twoje zgłoszenia na tym urządzeniu”: pary kod–klucz z ciasteczka, sprawdzone z bazą, najnowsze pierwsze. */
export async function rememberedThreads(): Promise<MyNeed[]> {
  const remembered = await rememberedNeeds();
  if (remembered.length === 0) return [];
  const codes = remembered.map((r) => r.code);
  const supabase = createAdminClient();
  const [needs, ideas] = await Promise.all([
    supabase.from("needs").select("status_code, status, card, created_at, access_hash").in("status_code", codes),
    supabase.from("ideas").select("status_code, status, fiszka, created_at, access_hash").in("status_code", codes),
  ]);
  if (needs.error) throw needs.error;
  if (ideas.error) throw ideas.error;

  const rows = [
    ...(needs.data ?? []).map((n) => ({
      hash: n.access_hash as string | null,
      mine: { kind: "potrzeba", code: n.status_code, status: n.status, summary: (n.card as { summary?: string }).summary ?? "", createdAt: n.created_at } satisfies MyNeed,
    })),
    ...(ideas.data ?? []).map((i) => ({
      hash: i.access_hash as string | null,
      mine: { kind: "pomysl", code: i.status_code, status: i.status, summary: (i.fiszka as { krotki_opis?: string }).krotki_opis ?? "", createdAt: i.created_at } satisfies MyNeed,
    })),
  ];
  // Kody są unikalne w obrębie tabeli; gdyby potrzeba i pomysł miały ten sam, rozstrzyga klucz.
  return remembered.flatMap(({ code, key }) => {
    const row = rows.find((r) => r.mine.code === code && keyMatches(r.hash, key));
    return row ? [row.mine] : [];
  });
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

const threadTitle = (t: ReportThread) => `${REPORTS[t.kind].title} ${t.code}`;

/** Zakłada wątek przy pierwszej wiadomości. Ekspert wybrany przez autora zostaje zapamiętany w wątku. */
async function ensureThread(t: ReportThread, expertId: string | null): Promise<string> {
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
      { entity_kind: t.kind, entity_id: t.reportId, title: threadTitle(t), expert_id: expertId },
      { onConflict: "entity_kind,entity_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Ekspert przypisany w Panelu do pomysłu. Zastępuje wybranego wcześniej; wątek powstaje, jeśli go nie było. */
export async function assignThreadExpert(t: ReportThread, expertId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("threads")
    .upsert(
      { entity_kind: t.kind, entity_id: t.reportId, title: threadTitle(t), expert_id: expertId },
      { onConflict: "entity_kind,entity_id" },
    );
  if (error) throw error;
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
 * i status „Odpowiedź” na osi czasu. `actorId` to admin piszący z Panelu (null przy koncie testowym).
 */
export async function postReportMessage(
  t: ReportThread,
  msg: { role: AuthorRole; name?: string; body: string; actorId?: string | null; expertId?: string | null },
): Promise<string> {
  const supabase = createAdminClient();
  const report = REPORTS[t.kind];
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
  const payload = { [report.payloadKey]: t.reportId, code: t.code, threadId };
  const recipient = fromAuthor ? { role: "admin" as const } : t.authorId ? { user_id: t.authorId } : null;
  if (recipient) {
    await notify({ ...recipient, kind: "nowa_wiadomosc", payload }).catch((e) => console.error("[rozmowy] powiadomienie:", e));
  }

  if (!fromAuthor && BEFORE_ANSWER.includes(t.status)) {
    const patch = t.kind === "potrzeba" ? { status: "odpowiedz", updated_at: now } : { status: "odpowiedz" };
    const { error: sError } = await supabase.from(report.table).update(patch).eq("id", t.reportId);
    if (sError) throw sError;
    await logChange(msg.actorId ?? null, `${report.audit}.status`, report.audit, t.reportId, {
      from: t.status,
      to: "odpowiedz",
      note: `Odpowiedź w rozmowie od: ${msg.name ?? ROLE_LABELS[msg.role]}`,
    });
  }

  await nudge(threadId);
  return threadId;
}
