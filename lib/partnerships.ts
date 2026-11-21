import "server-only";
import { emailAuthor } from "./author-contact";
import { notify, type NewNotification } from "./notifications";
import { SIMILAR_INITIATIVE_MIN_SIMILARITY } from "./schemas";
import { similarInitiatives } from "./search";
import { createAdminClient } from "./supabase/admin";
import { ROLE_LABELS, type AuthorRole, type ThreadMessage } from "./thread-types";
import { nudge } from "./threads";

/**
 * Partnerstwa: wątek grupowy autorów podobnych inicjatyw z różnych gmin. Autor zaprasza autorów podobnych
 * inicjatyw (similar_initiatives_kw); każdy z nich widzi wątek dopiero po zgodzie, a do tego czasu nikt nie poznaje
 * jego zgłoszenia (RODO). Zespół organizatora czyta i pisze w każdym wątku. Uczestnik to inicjatywa, nie konto:
 * autorzy piszą bez logowania, po kluczu z lib/initiatives/access.ts.
 */

export type ParticipantStatus = "zaproszone" | "przyjete" | "odrzucone";

/** Najwięcej zaproszeń na partnerstwo — tyle inicjatyw z innych gmin, ile zmieści się w jednej rozmowie. */
const MAX_INVITED = 20;

type InitiativeBasics = {
  id: string; code: string; teryt: string | null; gmina: string | null; title: string; summary: string; keywords: string[]; authorId: string | null;
};

/** Podpis w wątku i w zaproszeniu. Nazwy z BDL są bez słowa „gmina”, a inicjatywa bez gminy też musi się jakoś podpisać. */
export function gminaLabel(nazwa: string | null): string {
  if (!nazwa) return "Autor z regionu";
  return /^(gmina|miasto)\b/i.test(nazwa) ? nazwa : `Gmina ${nazwa}`;
}

async function initiativeBasics(by: { code: string } | { ids: string[] }): Promise<InitiativeBasics[]> {
  const query = createAdminClient().from("initiatives").select("id, status_code, teryt, title, summary, card, author_id, municipalities(name)");
  const { data, error } = await ("code" in by ? query.eq("status_code", by.code) : query.in("id", by.ids));
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id as string,
    code: n.status_code as string,
    teryt: n.teryt as string | null,
    gmina: (n.municipalities as unknown as { name: string } | null)?.name ?? null,
    title: n.title as string,
    summary: n.summary as string,
    keywords: (n.card as { keywords?: string[] }).keywords ?? [],
    authorId: n.author_id as string | null,
  }));
}

/** Inicjatywy, z którymi ta inicjatywa już jest w jakimś partnerstwie (zaproszone albo zapraszające). */
async function connected(initiativeId: string): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data: mine, error } = await supabase.from("thread_participants").select("thread_id").eq("initiative_id", initiativeId);
  if (error) throw error;
  if (!mine?.length) return new Set();
  const { data, error: pError } = await supabase
    .from("thread_participants").select("initiative_id").in("thread_id", mine.map((m) => m.thread_id)).not("initiative_id", "is", null);
  if (pError) throw pError;
  return new Set((data ?? []).map((r) => r.initiative_id as string));
}

/**
 * Inicjatywy z innych gmin, które dostaną zaproszenie — to samo kryterium co „w N innych gminach działa coś
 * podobnego”, bez tych, z którymi już jest partnerstwo.
 */
async function candidates(initiative: InitiativeBasics): Promise<{ initiativeId: string; gmina: string | null }[]> {
  const [similar, already] = await Promise.all([
    similarInitiatives(initiative.keywords, SIMILAR_INITIATIVE_MIN_SIMILARITY),
    connected(initiative.id),
  ]);
  return similar
    .filter((s) => s.initiative_id !== initiative.id && s.teryt && s.teryt !== initiative.teryt && !already.has(s.initiative_id))
    .slice(0, MAX_INVITED)
    .map((s) => ({ initiativeId: s.initiative_id, gmina: s.municipality }));
}

/** Co zobaczą zaproszeni (gmina i streszczenie) i które gminy dostaną zaproszenie — do pokazania przed wysłaniem. */
export async function partnershipPreview(code: string): Promise<{ gmina: string; summary: string; gminy: string[] } | null> {
  const [initiative] = await initiativeBasics({ code });
  if (!initiative) return null;
  const gminy = [...new Set((await candidates(initiative)).map((c) => gminaLabel(c.gmina)))];
  return { gmina: gminaLabel(initiative.gmina), summary: initiative.summary, gminy };
}

/** Partnerstwo widziane z jednej inicjatywy. Bez kodów i id cudzych inicjatyw — przeglądarka dostaje tylko nazwy gmin. */
export type Partnership = {
  threadId: string;
  initiator: string;
  /** Streszczenie inicjatywy zapraszającej — autor zgodził się je pokazać, wysyłając zaproszenie. */
  summary: string;
  isInitiator: boolean;
  myStatus: ParticipantStatus;
  /** Gminy, które przyjęły zaproszenie (z zapraszającą). Pozostałych nie pokazujemy, dopóki się nie zgodzą. */
  joined: string[];
  /** Zaproszenia bez odpowiedzi. Odmów nie liczymy osobno, żeby nie zdradzać, kto odmówił. */
  waiting: number;
  /** Autorzy, którzy dołączyli, bez zapraszającego. Zero przy `waiting` = 0: nikt nie przyjął zaproszenia. */
  partners: number;
  createdAt: string;
};

type ParticipantRow = { thread_id: string; initiative_id: string | null; status: ParticipantStatus };

async function threadsOf(initiativeId: string) {
  const supabase = createAdminClient();
  const { data: mine, error } = await supabase.from("thread_participants").select("thread_id").eq("initiative_id", initiativeId);
  if (error) throw error;
  const threadIds = (mine ?? []).map((m) => m.thread_id as string);
  if (threadIds.length === 0) return null;
  const [threads, participants] = await Promise.all([
    supabase.from("threads").select("id, entity_id, created_at").eq("entity_kind", "partnership").in("id", threadIds),
    supabase.from("thread_participants").select("thread_id, initiative_id, status").in("thread_id", threadIds).not("initiative_id", "is", null),
  ]);
  if (threads.error) throw threads.error;
  if (participants.error) throw participants.error;
  const rows = (participants.data ?? []) as ParticipantRow[];
  const basics = new Map((await initiativeBasics({ ids: [...new Set(rows.map((r) => r.initiative_id!))] })).map((n) => [n.id, n]));
  return { threads: (threads.data ?? []) as { id: string; entity_id: string; created_at: string }[], rows, basics };
}

/** Wszystkie partnerstwa, w których jest ta inicjatywa (zaproszenia, przyjęte, odrzucone). */
export async function initiativePartnerships(initiativeId: string): Promise<Partnership[]> {
  const found = await threadsOf(initiativeId);
  if (!found) return [];
  const { threads, rows, basics } = found;
  return threads
    .map((t) => {
      const inThread = rows.filter((r) => r.thread_id === t.id);
      const initiator = basics.get(t.entity_id);
      return {
        threadId: t.id,
        initiator: gminaLabel(initiator?.gmina ?? null),
        summary: initiator?.summary ?? "",
        isInitiator: t.entity_id === initiativeId,
        myStatus: inThread.find((r) => r.initiative_id === initiativeId)!.status,
        joined: [...new Set(inThread.filter((r) => r.status === "przyjete").map((r) => gminaLabel(basics.get(r.initiative_id!)?.gmina ?? null)))],
        waiting: inThread.filter((r) => r.status === "zaproszone").length,
        partners: inThread.filter((r) => r.status === "przyjete" && r.initiative_id !== t.entity_id).length,
        createdAt: t.created_at,
      };
    })
    .sort((a, b) => (a.isInitiator === b.isInitiator ? b.createdAt.localeCompare(a.createdAt) : a.isInitiator ? -1 : 1));
}

/**
 * Zakłada partnerstwo inicjatywy (jedno na inicjatywę) i wysyła zaproszenia. Drugi raz nie zaprasza ponownie.
 * Zaproszeni z kontem dostają powiadomienie w dzwonku, pozostali zobaczą je przy swojej rozmowie (/partnerstwo).
 */
export async function startPartnership(code: string): Promise<{ threadId: string; invited: number } | null> {
  const supabase = createAdminClient();
  const [initiative] = await initiativeBasics({ code });
  if (!initiative) return null;

  const { data: existing, error: eError } = await supabase
    .from("threads").select("id").eq("entity_kind", "partnership").eq("entity_id", initiative.id).maybeSingle();
  if (eError) throw eError;
  if (existing) return { threadId: existing.id, invited: 0 };

  const invited = await candidates(initiative);
  const { data: thread, error } = await supabase
    .from("threads")
    .insert({ entity_kind: "partnership", entity_id: initiative.id, title: `Partnerstwo: ${initiative.title}`.slice(0, 200) })
    .select("id")
    .single();
  if (error) throw error;

  const now = new Date().toISOString();
  const { error: pError } = await supabase.from("thread_participants").insert([
    { thread_id: thread.id, initiative_id: initiative.id, status: "przyjete", responded_at: now },
    ...invited.map((c) => ({ thread_id: thread.id, initiative_id: c.initiativeId, status: "zaproszone" })),
  ]);
  if (pError) throw pError;

  const gmina = gminaLabel(initiative.gmina);
  const invitees = await initiativeBasics({ ids: invited.map((c) => c.initiativeId) });
  const rows: NewNotification[] = [
    { role: "admin", kind: "partnerstwo_nowe", payload: { initiativeId: initiative.id, code: initiative.code, gmina, invited: invited.length } },
    ...invitees.flatMap((n): NewNotification[] => n.authorId
      ? [{ user_id: n.authorId, kind: "partnerstwo_zaproszenie", payload: { code: n.code, gmina } }]
      : []),
  ];
  await notify(rows).catch((e) => console.error("[partnerstwa] powiadomienie:", e));
  // Autorzy bez konta, którzy podali e-mail. Treść ogólna, bez nazwy gminy i opisu — e-mail może przeczytać ktoś inny.
  await Promise.all(invitees.map((n) => emailAuthor(n.id, "Autor podobnej inicjatywy zaprasza Cię do rozmowy")));
  return { threadId: thread.id, invited: invited.length };
}

/** Zgoda albo odmowa zaproszonego. Zmienić można tylko zaproszenie, na które jeszcze nie odpowiedziano. */
export async function respondToInvitation(initiativeId: string, threadId: string, accept: boolean): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("thread_participants")
    .update({ status: accept ? "przyjete" : "odrzucone", responded_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("initiative_id", initiativeId)
    .eq("status", "zaproszone")
    .select("thread_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;

  if (accept) {
    const [{ data: thread }, [initiative]] = await Promise.all([
      supabase.from("threads").select("entity_id").eq("id", threadId).single(),
      initiativeBasics({ ids: [initiativeId] }),
    ]);
    await notify({
      role: "admin",
      kind: "partnerstwo_dolaczenie",
      payload: { initiativeId: thread?.entity_id, gmina: gminaLabel(initiative?.gmina ?? null) },
    }).catch((e) => console.error("[partnerstwa] powiadomienie:", e));
    await nudge(threadId);
  }
  return true;
}

export type PartnershipThread = { threadId: string; messages: ThreadMessage[] };

/** Wiadomości wątku. `viewerInitiativeId` oznacza wiadomości tej inicjatywy jako „Ty”; admin podaje null. */
export async function partnershipMessages(threadId: string, viewerInitiativeId: string | null): Promise<ThreadMessage[]> {
  const { data, error } = await createAdminClient()
    .from("messages")
    .select("id, author_role, author_name, author_initiative, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    role: m.author_role as AuthorRole,
    name: m.author_name ?? ROLE_LABELS[m.author_role as AuthorRole],
    body: m.body,
    createdAt: m.created_at,
    mine: viewerInitiativeId ? m.author_initiative === viewerInitiativeId : undefined,
  }));
}

/** Czy inicjatywa przyjęła zaproszenie (albo sama zaprasza) — tylko wtedy jej autor czyta i pisze w wątku. */
export async function isMember(initiativeId: string, threadId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("thread_participants")
    .select("status")
    .eq("thread_id", threadId)
    .eq("initiative_id", initiativeId)
    .eq("status", "przyjete")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Wiadomość autora (`from.initiativeId`) albo zespołu (`from.actorId`, z Panelu). Powiadamiamy admina, gdy pisze
 * autor, oraz uczestników z kontem, którzy przyjęli zaproszenie — poza autorem wiadomości.
 */
export async function postPartnershipMessage(
  threadId: string,
  from: { initiativeId: string } | { actorId: string | null },
  body: string,
): Promise<void> {
  const supabase = createAdminClient();
  const [{ data: thread, error: tError }, { data: members, error: mError }] = await Promise.all([
    supabase.from("threads").select("entity_id").eq("id", threadId).eq("entity_kind", "partnership").single(),
    supabase.from("thread_participants").select("initiative_id").eq("thread_id", threadId).eq("status", "przyjete").not("initiative_id", "is", null),
  ]);
  if (tError) throw tError;
  if (mError) throw mError;
  const basics = await initiativeBasics({ ids: (members ?? []).map((m) => m.initiative_id as string) });

  const author = "initiativeId" in from ? basics.find((n) => n.id === from.initiativeId) : null;
  if ("initiativeId" in from && !author) throw new Error("Inicjatywa nie jest uczestnikiem partnerstwa");
  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    author_id: "actorId" in from ? from.actorId : null,
    author_initiative: author?.id ?? null,
    author_role: author ? "author" : "staff",
    author_name: author ? gminaLabel(author.gmina) : ROLE_LABELS.staff,
    body,
  });
  if (error) throw error;
  const { error: uError } = await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
  if (uError) console.error("[partnerstwa] updated_at:", uError);

  const rows: NewNotification[] = [
    ...(author ? [{ role: "admin" as const, kind: "partnerstwo_wiadomosc", payload: { initiativeId: thread.entity_id, gmina: gminaLabel(author.gmina) } }] : []),
    ...basics.flatMap((n): NewNotification[] => n.authorId && n.id !== author?.id
      ? [{ user_id: n.authorId, kind: "partnerstwo_wiadomosc", payload: { code: n.code, threadId } }]
      : []),
  ];
  await notify(rows).catch((e) => console.error("[partnerstwa] powiadomienie:", e));
  await Promise.all(basics.filter((n) => n.id !== author?.id).map((n) => emailAuthor(n.id, "Nowa wiadomość w partnerstwie")));
  await nudge(threadId);
}

/** Panel: partnerstwa inicjatywy z pełną listą uczestników (kody i statusy widzi tylko admin). */
export type PanelPartnership = {
  threadId: string;
  initiatorId: string;
  isInitiator: boolean;
  participants: { initiativeId: string; code: string; gmina: string; status: ParticipantStatus; isInitiator: boolean }[];
  messages: ThreadMessage[];
};

export async function panelPartnerships(initiativeId: string): Promise<PanelPartnership[]> {
  const found = await threadsOf(initiativeId);
  if (!found) return [];
  const { threads, rows, basics } = found;
  return Promise.all(threads.map(async (t) => ({
    threadId: t.id,
    initiatorId: t.entity_id,
    isInitiator: t.entity_id === initiativeId,
    participants: rows
      .filter((r) => r.thread_id === t.id)
      .map((r) => ({
        initiativeId: r.initiative_id!,
        code: basics.get(r.initiative_id!)?.code ?? "",
        gmina: gminaLabel(basics.get(r.initiative_id!)?.gmina ?? null),
        status: r.status,
        isInitiator: r.initiative_id === t.entity_id,
      }))
      .sort((a, b) => Number(b.isInitiator) - Number(a.isInitiator)),
    messages: await partnershipMessages(t.id, null),
  })));
}
