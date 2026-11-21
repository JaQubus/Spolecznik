import "server-only";
import { asksAboutOwnCase } from "./first-line-guard";
import { initiativeHref } from "./knowledge/hrefs";
import { answerInThread, tagCard, type KnowledgeSource } from "./llm";
import { NOVELTY_MIN_SIMILARITY } from "./schemas";
import { keywordSearch } from "./search";
import { createAdminClient } from "./supabase/admin";
import type { MessageSource } from "./thread-types";
import { org } from "@/lib/brand";

/**
 * Asystent jako pierwsza linia w rozmowie autora z zespołem. Lematy pytania z LLM → opublikowane inicjatywy → odpowiedź tylko ze źródłami. Bez źródeł albo przy pytaniu o własną
 * sprawę asystent nie zgaduje, tylko przekazuje pytanie człowiekowi.
 */
export type FirstLine =
  | { outcome: "odpowiedz"; body: string; sources: MessageSource[] }
  /** reason: „sprawa” — pytanie o status, termin, decyzję; „brak_zrodel” — baza nie zna odpowiedzi albo AI nie działa. */
  | { outcome: "przekazano"; reason: "sprawa" | "brak_zrodel" }
  /** Wiadomość nie jest pytaniem (podziękowanie, uzupełnienie) — asystent milczy, przeczyta ją człowiek. */
  | { outcome: "bez_pytania" };

export const FORWARD_MESSAGES: Record<"sprawa" | "brak_zrodel", string> = {
  sprawa: `Pytanie dotyczy Twojej sprawy, więc nie zgaduję. Przekazałem pytanie do zespołu ${org.short} — odpowiedź pojawi się tutaj, w tej rozmowie.`,
  brak_zrodel: `W bazie innowacji nie znalazłem pewnej odpowiedzi, więc nie zgaduję. Przekazałem pytanie do zespołu ${org.short} — odpowiedź pojawi się tutaj, w tej rozmowie.`,
};

/** `message` jest już zanonimizowana (lib/pii.ts). Błędy AI i bazy kończą się przekazaniem, nigdy wyjątkiem. */
export async function firstLine(message: string): Promise<FirstLine> {
  if (asksAboutOwnCase(message)) return { outcome: "przekazano", reason: "sprawa" };
  try {
    const { lemmas } = await tagCard(`Pytanie do ${org.short}`, message);
    const relevant = (hits: Awaited<ReturnType<typeof keywordSearch>>) => hits.filter((h) => h.similarity >= NOVELTY_MIN_SIMILARITY);
    const initiativeHits = await keywordSearch("initiative", lemmas, 3).then(relevant);

    const supabase = createAdminClient();
    const initiativeIds = initiativeHits.map((h) => h.ref_id);
    const [initiatives] = await Promise.all([
      // Tylko opublikowane: treść cudzych zgłoszeń przed weryfikacją jest prywatna.
      initiativeIds.length
        ? supabase.from("public_initiatives").select("id, slug, title, summary, card").in("id", initiativeIds)
        : { data: [], error: null },
    ]);
    if (initiatives.error) throw initiatives.error;
    if (!initiatives.data?.length) return { outcome: "przekazano", reason: "brak_zrodel" };

    // Ta sama kolejność w obu listach: numer źródła z modelu wskazuje wpis w `stored`.
    const known: KnowledgeSource[] = [];
    const stored: MessageSource[] = [];
    for (const i of initiatives.data ?? []) {
      const card = (i.card ?? {}) as { problem?: string; solution?: string };
      known.push({ kind: "inicjatywa", title: i.title as string, text: [i.summary, card.problem, card.solution].filter(Boolean).join(" ") });
      stored.push({ kind: "inicjatywa", title: i.title as string, href: i.slug ? initiativeHref(i.slug as string) : null });
    }

    const result = await answerInThread(message, known);
    if (result.decision === "bez_pytania") return { outcome: "bez_pytania" };
    if (result.decision === "przekaz") return { outcome: "przekazano", reason: "brak_zrodel" };
    return { outcome: "odpowiedz", body: result.answer, sources: result.sources.map((n) => stored[n]) };
  } catch (e) {
    console.error("[rozmowy] asystent:", e);
    return { outcome: "przekazano", reason: "brak_zrodel" };
  }
}
