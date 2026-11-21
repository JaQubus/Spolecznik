import "server-only";
import { asksAboutOwnCase } from "./first-line-guard";
import { knowledge } from "./knowledge";
import { initiativeHref, patternHref } from "./knowledge/hrefs";
import { answerInThread, tagCard, type KnowledgeSource } from "./llm";
import { NOVELTY_MIN_SIMILARITY } from "./schemas";
import { keywordSearch } from "./search";
import { createAdminClient } from "./supabase/admin";
import type { MessageSource } from "./thread-types";
import { org } from "@/lib/brand";

/**
 * Asystent jako pierwsza linia w rozmowie autora z zespołem. Lematy pytania z LLM → fakty o regionie, sprawdzone
 * rozwiązania i opublikowane inicjatywy → odpowiedź tylko ze źródłami. Bez źródeł albo przy pytaniu o własną
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
  brak_zrodel: `W bazie wiedzy nie znalazłem pewnej odpowiedzi, więc nie zgaduję. Przekazałem pytanie do zespołu ${org.short} — odpowiedź pojawi się tutaj, w tej rozmowie.`,
};

const FACTS = 4;

/** `message` jest już zanonimizowana (lib/pii.ts). Błędy AI i bazy kończą się przekazaniem, nigdy wyjątkiem. */
export async function firstLine(message: string): Promise<FirstLine> {
  if (asksAboutOwnCase(message)) return { outcome: "przekazano", reason: "sprawa" };
  try {
    const { lemmas, domains } = await tagCard(`Pytanie do ${org.short}`, message);
    const relevant = (hits: Awaited<ReturnType<typeof keywordSearch>>) => hits.filter((h) => h.similarity >= NOVELTY_MIN_SIMILARITY);
    const [patternHits, initiativeHits, facts] = await Promise.all([
      keywordSearch("pattern", lemmas, 3).then(relevant),
      keywordSearch("initiative", lemmas, 3).then(relevant),
      domains.length ? knowledge.facts().then((all) => all.filter((f) => domains.includes(f.domain)).slice(0, FACTS)) : [],
    ]);

    const supabase = createAdminClient();
    const patternIds = patternHits.map((h) => h.ref_id);
    const initiativeIds = initiativeHits.map((h) => h.ref_id);
    const [patterns, initiatives] = await Promise.all([
      patternIds.length
        ? supabase.from("patterns").select("id, slug, title, problem, solution").in("id", patternIds)
        : { data: [], error: null },
      // Tylko opublikowane: treść cudzych zgłoszeń przed weryfikacją jest prywatna.
      initiativeIds.length
        ? supabase.from("public_initiatives").select("id, slug, title, summary, card").in("id", initiativeIds)
        : { data: [], error: null },
    ]);
    if (patterns.error) throw patterns.error;
    if (initiatives.error) throw initiatives.error;
    if (facts.length === 0 && !patterns.data?.length && !initiatives.data?.length) return { outcome: "przekazano", reason: "brak_zrodel" };

    // Ta sama kolejność w obu listach: numer źródła z modelu wskazuje wpis w `stored`.
    const known: KnowledgeSource[] = [];
    const stored: MessageSource[] = [];
    for (const f of facts) {
      known.push({ kind: "fakt", title: f.sourceTitle ?? "Bank Danych Lokalnych GUS", text: `${f.displayValue}: ${f.sentence}` });
      stored.push({ kind: "fakt", title: f.sourceTitle ?? "Bank Danych Lokalnych GUS", href: f.sourceUrl, year: f.dataYear });
    }
    for (const p of patterns.data ?? []) {
      known.push({ kind: "rozwiazanie", title: p.title as string, text: `${p.problem ?? ""} ${p.solution ?? ""}`.trim() });
      stored.push({ kind: "rozwiazanie", title: p.title as string, href: patternHref((p.slug as string | null) ?? (p.id as string)) });
    }
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
