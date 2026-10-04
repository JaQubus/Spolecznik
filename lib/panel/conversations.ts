import "server-only";
import { NO_ANSWER } from "../rops-first-line";
import { createAdminClient } from "../supabase/admin";

/** Co zrobił asystent AI od ostatniej wiadomości człowieka: odpowiedział z Zasobnika, przekazał sprawę albo nic. */
export type Waiting = { ai: "odpowiedz" | "przekazanie" | null };

/**
 * Rozmowy, w których autor napisał po ostatniej odpowiedzi ROPS albo eksperta (albo nikt jeszcze nie odpisał).
 * Odpowiedź asystenta AI nie zamyka sprawy — pierwsza linia „Zapytaj ROPS” tylko odciąża, człowiek i tak czyta.
 * Zwraca mapę id zgłoszenia albo pomysłu → stan; brak wpisu = nic nie czeka.
 */
export async function waitingForHuman(kind: "potrzeba" | "pomysl", ids: string[]): Promise<Map<string, Waiting>> {
  if (ids.length === 0) return new Map();
  try {
    const supabase = createAdminClient();
    const { data: threads, error } = await supabase
      .from("threads")
      .select("id, entity_id")
      .eq("entity_kind", kind)
      .in("entity_id", ids);
    if (error) throw error;
    if (!threads?.length) return new Map();

    const { data: messages, error: mError } = await supabase
      .from("messages")
      .select("thread_id, author_role, body")
      .in("thread_id", threads.map((t) => t.id))
      .order("created_at", { ascending: true });
    if (mError) throw mError;

    const byThread = new Map<string, NonNullable<typeof messages>>();
    for (const m of messages ?? []) byThread.set(m.thread_id, [...(byThread.get(m.thread_id) ?? []), m]);
    const result = new Map<string, Waiting>();
    for (const t of threads) {
      const list = byThread.get(t.id) ?? [];
      const lastHuman = list.findLastIndex((m) => m.author_role === "rops" || m.author_role === "ekspert");
      const since = list.slice(lastHuman + 1);
      if (!since.some((m) => m.author_role === "autor")) continue;
      const ai = since.filter((m) => m.author_role === "ai");
      result.set(t.entity_id as string, {
        ai: ai.some((m) => m.body !== NO_ANSWER) ? "odpowiedz" : ai.length ? "przekazanie" : null,
      });
    }
    return result;
  } catch (e) {
    console.error("[panel] rozmowy czekające:", e); // lista działa dalej, tylko bez tej etykiety
    return new Map();
  }
}

export const AI_LABELS: Record<NonNullable<Waiting["ai"]>, string> = {
  odpowiedz: "AI odpowiedział z Zasobnika",
  przekazanie: "AI przekazał do ROPS",
};
