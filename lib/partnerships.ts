import "server-only";
import { emailAuthor } from "./author-contact";
import { notify, type NewNotification } from "./notifications";
import { SIMILAR_NEED_MIN_SIMILARITY } from "./schemas";
import { similarNeeds } from "./search";
import { createAdminClient } from "./supabase/admin";
import { ROLE_LABELS, type ThreadMessage } from "./thread-types";
import { nudge } from "./threads";

/**
 * Społecznik·Partnerstwa (README §6, #20): wątek grupowy gmin, które zgłosiły podobny problem.
 * Gmina zaprasza autorów podobnych zgłoszeń (similar_needs_kw); każdy z nich widzi wątek dopiero po zgodzie,
 * a do tego czasu nikt nie poznaje jego zgłoszenia (RODO, README §10). Admin ROPS czyta i pisze w każdym wątku.
 * Uczestnik to zgłoszenie, nie konto: autorzy piszą bez logowania, po kluczu z lib/need-access.ts.
 */

export type ParticipantStatus = "zaproszone" | "przyjete" | "odrzucone";

/** Najwięcej zaproszeń na partnerstwo — tyle zgłoszeń z innych gmin, ile zmieści się w jednej rozmowie. */
const MAX_INVITED = 20;

type NeedBasics = { id: string; code: string; teryt: string | null; gmina: string | null; summary: string; keywords: string[]; authorId: string | null };

/** Podpis w wątku i w zaproszeniu. Nazwy z BDL są bez słowa „gmina”, a zgłoszenie bez gminy też musi się jakoś podpisać. */
export function gminaLabel(nazwa: string | null): string {
  if (!nazwa) return "Jedna z gmin";
  return /^(gmina|miasto)\b/i.test(nazwa) ? nazwa : `Gmina ${nazwa}`;
}

async function needBasics(by: { code: string } | { ids: string[] }): Promise<NeedBasics[]> {
  const query = createAdminClient().from("needs").select("id, status_code, teryt, card, author_id, gminy(nazwa)");
  const { data, error } = await ("code" in by ? query.eq("status_code", by.code) : query.in("id", by.ids));
  if (error) throw error;
  return (data ?? []).map((n) => {
    const card = n.card as { summary?: string; keywords?: string[] };
    return {
      id: n.id,
      code: n.status_code,
      teryt: n.teryt,
      gmina: (n.gminy as unknown as { nazwa: string } | null)?.nazwa ?? null,
      summary: card.summary ?? "",
      keywords: card.keywords ?? [],
      authorId: n.author_id,
    };
  });
}

/** Zgłoszenia, z którymi to zgłoszenie już jest w jakimś partnerstwie (zaproszone albo zapraszające). */
async function connectedNeeds(needId: string): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data: mine, error } = await supabase.from("thread_participants").select("thread_id").eq("need_id", needId);
  if (error) throw error;
  if (!mine?.length) return new Set();
  const { data, error: pError } = await supabase
    .from("thread_participants").select("need_id").in("thread_id", mine.map((m) => m.thread_id)).not("need_id", "is", null);
  if (pError) throw pError;
  return new Set((data ?? []).map((r) => r.need_id as string));
}

/**
 * Zgłoszenia z innych gmin, które dostaną zaproszenie — to samo kryterium co „N innych gmin zgłosiło podobny problem”,
 * bez tych, z którymi już jest partnerstwo (inaczej zaproszony od razu zaprosiłby zapraszającego do drugiej rozmowy).
 */
async function candidates(need: NeedBasics): Promise<{ needId: string; gmina: string | null }[]> {
  const [similar, connected] = await Promise.all([similarNeeds(need.keywords, SIMILAR_NEED_MIN_SIMILARITY), connectedNeeds(need.id)]);
  return similar
    .filter((s) => s.need_id !== need.id && s.teryt && s.teryt !== need.teryt && !connected.has(s.need_id))
    .slice(0, MAX_INVITED)
    .map((s) => ({ needId: s.need_id, gmina: s.gmina }));
}

/** Co zobaczą zaproszeni (nazwa gminy i opis problemu) i które gminy dostaną zaproszenie — do pokazania przed wysłaniem. */
export async function partnershipPreview(code: string): Promise<{ gmina: string; summary: string; gminy: string[] } | null> {
  const [need] = await needBasics({ code });
  if (!need) return null;
  const gminy = [...new Set((await candidates(need)).map((c) => gminaLabel(c.gmina)))];
  return { gmina: gminaLabel(need.gmina), summary: need.summary, gminy };
}

/** Partnerstwo widziane z jednego zgłoszenia. Bez kodów i id cudzych zgłoszeń — przeglądarka dostaje tylko nazwy gmin. */
export type Partnership = {
  threadId: string;
  initiator: string;
  /** Opis problemu gminy zapraszającej — ona zgodziła się go pokazać, wysyłając zaproszenie. */
  summary: string;
  isInitiator: boolean;
  myStatus: ParticipantStatus;
  /** Gminy, które przyjęły zaproszenie (z zapraszającą). Pozostałych nie pokazujemy, dopóki się nie zgodzą. */
  joined: string[];
  /** Zaproszenia bez odpowiedzi. Odmów nie liczymy osobno, żeby nie zdradzać, kto odmówił. */
  waiting: number;
  createdAt: string;
};

type ParticipantRow = { thread_id: string; need_id: string | null; status: ParticipantStatus };

/** Wszystkie partnerstwa, w których jest to zgłoszenie (zaproszenia, przyjęte, odrzucone). */
export async function needPartnerships(needId: string): Promise<Partnership[]> {
  const supabase = createAdminClient();
  const { data: mine, error } = await supabase.from("thread_participants").select("thread_id").eq("need_id", needId);
  if (error) throw error;
  const threadIds = (mine ?? []).map((m) => m.thread_id as string);
  if (threadIds.length === 0) return [];

  const [threads, participants] = await Promise.all([
    supabase.from("threads").select("id, entity_id, created_at").eq("entity_kind", "partnerstwo").in("id", threadIds),
    supabase.from("thread_participants").select("thread_id, need_id, status").in("thread_id", threadIds).not("need_id", "is", null),
  ]);
  if (threads.error) throw threads.error;
  if (participants.error) throw participants.error;
  const rows = (participants.data ?? []) as ParticipantRow[];
  const needs = new Map((await needBasics({ ids: [...new Set(rows.map((r) => r.need_id!))] })).map((n) => [n.id, n]));

  return (threads.data ?? [])
    .map((t) => {
      const inThread = rows.filter((r) => r.thread_id === t.id);
      const initiator = needs.get(t.entity_id);
      return {
        threadId: t.id,
        initiator: gminaLabel(initiator?.gmina ?? null),
        summary: initiator?.summary ?? "",
        isInitiator: t.entity_id === needId,
        myStatus: inThread.find((r) => r.need_id === needId)!.status,
        joined: [...new Set(inThread.filter((r) => r.status === "przyjete").map((r) => gminaLabel(needs.get(r.need_id!)?.gmina ?? null)))],
        waiting: inThread.filter((r) => r.status === "zaproszone").length,
        createdAt: t.created_at,
      };
    })
    .sort((a, b) => (a.isInitiator === b.isInitiator ? b.createdAt.localeCompare(a.createdAt) : a.isInitiator ? -1 : 1));
}

/**
 * Zakłada partnerstwo zgłoszenia (jedno na zgłoszenie) i wysyła zaproszenia. Drugi raz nie zaprasza ponownie.
 * Zaproszeni z kontem dostają powiadomienie w dzwonku, pozostali zobaczą je przy swojej rozmowie (/partnerstwo).
 */
export async function startPartnership(code: string): Promise<{ threadId: string; invited: number } | null> {
  const supabase = createAdminClient();
  const [need] = await needBasics({ code });
  if (!need) return null;

  const { data: existing, error: eError } = await supabase
    .from("threads").select("id").eq("entity_kind", "partnerstwo").eq("entity_id", need.id).maybeSingle();
  if (eError) throw eError;
  if (existing) return { threadId: existing.id, invited: 0 };

  const invited = await candidates(need);
  const { data: thread, error } = await supabase
    .from("threads")
    .insert({ entity_kind: "partnerstwo", entity_id: need.id, title: `Partnerstwo: ${need.summary}`.slice(0, 200) })
    .select("id")
    .single();
  if (error) throw error;

  const now = new Date().toISOString();
  const { error: pError } = await supabase.from("thread_participants").insert([
    { thread_id: thread.id, need_id: need.id, status: "przyjete", responded_at: now },
    ...invited.map((c) => ({ thread_id: thread.id, need_id: c.needId, status: "zaproszone" })),
  ]);
  if (pError) throw pError;

  const gmina = gminaLabel(need.gmina);
  const invitees = await needBasics({ ids: invited.map((c) => c.needId) });
  const rows: NewNotification[] = [
    { role: "admin", kind: "partnerstwo_nowe", payload: { needId: need.id, code: need.code, gmina, invited: invited.length } },
    ...invitees.flatMap((n): NewNotification[] => n.authorId
      ? [{ user_id: n.authorId, kind: "partnerstwo_zaproszenie", payload: { code: n.code, gmina } }]
      : []),
  ];
  await notify(rows).catch((e) => console.error("[partnerstwa] powiadomienie:", e));
  // Autorzy bez konta, którzy podali e-mail (#65). Treść ogólna, bez nazwy gminy i opisu — e-mail może przeczytać ktoś inny.
  await Promise.all(invitees.map((n) => emailAuthor("potrzeba", n.id, "Inna gmina zaprasza Cię do rozmowy o podobnym problemie")));
  return { threadId: thread.id, invited: invited.length };
}

/** Zgoda albo odmowa zaproszonego. Zmienić można tylko zaproszenie, na które jeszcze nie odpowiedziano. */
export async function respondToInvitation(needId: string, threadId: string, accept: boolean): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("thread_participants")
    .update({ status: accept ? "przyjete" : "odrzucone", responded_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("need_id", needId)
    .eq("status", "zaproszone")
    .select("thread_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;

  if (accept) {
    const [{ data: thread }, [need]] = await Promise.all([
      supabase.from("threads").select("entity_id").eq("id", threadId).single(),
      needBasics({ ids: [needId] }),
    ]);
    await notify({
      role: "admin",
      kind: "partnerstwo_dolaczenie",
      payload: { needId: thread?.entity_id, gmina: gminaLabel(need?.gmina ?? null) },
    }).catch((e) => console.error("[partnerstwa] powiadomienie:", e));
    await nudge(threadId);
  }
  return true;
}

export type PartnershipThread = { threadId: string; messages: ThreadMessage[] };

/** Wiadomości wątku. `viewerNeedId` oznacza wiadomości tego zgłoszenia jako „Ty”; admin podaje null. */
export async function partnershipMessages(threadId: string, viewerNeedId: string | null): Promise<ThreadMessage[]> {
  const { data, error } = await createAdminClient()
    .from("messages")
    .select("id, author_role, author_name, author_need, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    role: m.author_role,
    name: m.author_name ?? ROLE_LABELS[m.author_role as keyof typeof ROLE_LABELS],
    body: m.body,
    createdAt: m.created_at,
    mine: viewerNeedId ? m.author_need === viewerNeedId : undefined,
  }));
}

/** Czy zgłoszenie przyjęło zaproszenie (albo samo zaprasza) — tylko wtedy czyta i pisze w wątku. */
export async function isMember(needId: string, threadId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("thread_participants")
    .select("status")
    .eq("thread_id", threadId)
    .eq("need_id", needId)
    .eq("status", "przyjete")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Wiadomość gminy (`from.needId`) albo ROPS (`from.actorId`, z Panelu). Powiadamiamy admina, gdy pisze gmina,
 * oraz uczestników z kontem, którzy przyjęli zaproszenie — poza autorem wiadomości.
 */
export async function postPartnershipMessage(
  threadId: string,
  from: { needId: string } | { actorId: string | null },
  body: string,
): Promise<void> {
  const supabase = createAdminClient();
  const [{ data: thread, error: tError }, { data: members, error: mError }] = await Promise.all([
    supabase.from("threads").select("entity_id").eq("id", threadId).eq("entity_kind", "partnerstwo").single(),
    supabase.from("thread_participants").select("need_id").eq("thread_id", threadId).eq("status", "przyjete").not("need_id", "is", null),
  ]);
  if (tError) throw tError;
  if (mError) throw mError;
  const needs = await needBasics({ ids: (members ?? []).map((m) => m.need_id as string) });

  const author = "needId" in from ? needs.find((n) => n.id === from.needId) : null;
  if ("needId" in from && !author) throw new Error("Zgłoszenie nie jest uczestnikiem partnerstwa");
  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    author_id: "actorId" in from ? from.actorId : null,
    author_need: author?.id ?? null,
    author_role: author ? "autor" : "rops",
    author_name: author ? gminaLabel(author.gmina) : ROLE_LABELS.rops,
    body,
  });
  if (error) throw error;
  const { error: uError } = await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
  if (uError) console.error("[partnerstwa] updated_at:", uError);

  const rows: NewNotification[] = [
    ...(author ? [{ role: "admin" as const, kind: "partnerstwo_wiadomosc", payload: { needId: thread.entity_id, gmina: gminaLabel(author.gmina) } }] : []),
    ...needs.flatMap((n): NewNotification[] => n.authorId && n.id !== author?.id
      ? [{ user_id: n.authorId, kind: "partnerstwo_wiadomosc", payload: { code: n.code, threadId } }]
      : []),
  ];
  await notify(rows).catch((e) => console.error("[partnerstwa] powiadomienie:", e));
  await Promise.all(needs.filter((n) => n.id !== author?.id).map((n) => emailAuthor("potrzeba", n.id, "Nowa wiadomość w partnerstwie gmin")));
  await nudge(threadId);
}

/** Panel: partnerstwa zgłoszenia z pełną listą uczestników (kody i statusy widzi tylko admin). */
export type PanelPartnership = {
  threadId: string;
  initiatorNeedId: string;
  isInitiator: boolean;
  participants: { needId: string; code: string; gmina: string; status: ParticipantStatus; isInitiator: boolean }[];
  messages: ThreadMessage[];
};

export async function panelPartnerships(needId: string): Promise<PanelPartnership[]> {
  const supabase = createAdminClient();
  const { data: mine, error } = await supabase.from("thread_participants").select("thread_id").eq("need_id", needId);
  if (error) throw error;
  const threadIds = (mine ?? []).map((m) => m.thread_id as string);
  if (threadIds.length === 0) return [];

  const [threads, participants] = await Promise.all([
    supabase.from("threads").select("id, entity_id").eq("entity_kind", "partnerstwo").in("id", threadIds),
    supabase.from("thread_participants").select("thread_id, need_id, status").in("thread_id", threadIds).not("need_id", "is", null),
  ]);
  if (threads.error) throw threads.error;
  if (participants.error) throw participants.error;
  const rows = (participants.data ?? []) as ParticipantRow[];
  const needs = new Map((await needBasics({ ids: [...new Set(rows.map((r) => r.need_id!))] })).map((n) => [n.id, n]));

  return Promise.all((threads.data ?? []).map(async (t) => ({
    threadId: t.id,
    initiatorNeedId: t.entity_id,
    isInitiator: t.entity_id === needId,
    participants: rows
      .filter((r) => r.thread_id === t.id)
      .map((r) => ({
        needId: r.need_id!,
        code: needs.get(r.need_id!)?.code ?? "",
        gmina: gminaLabel(needs.get(r.need_id!)?.gmina ?? null),
        status: r.status,
        isInitiator: r.need_id === t.entity_id,
      }))
      .sort((a, b) => Number(b.isInitiator) - Number(a.isInitiator)),
    messages: await partnershipMessages(t.id, null),
  })));
}
