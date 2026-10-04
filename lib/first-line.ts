import "server-only";
import { asksAboutOwnCase } from "./first-line-guard";
import { innovationHref } from "./knowledge/hrefs";
import { answerInThread, tagCard, type KnowledgeSource } from "./llm";
import { NOVELTY_MIN_SIMILARITY } from "./schemas";
import { keywordSearch, searchDocChunks } from "./search";
import { createAdminClient } from "./supabase/admin";
import { reportPageHref, type MessageSource } from "./thread-types";

/**
 * „Zapytaj ROPS”: asystent jako pierwsza linia (#20). Ten sam mechanizm co „Zapytaj Bibliotekę” (/api/ask):
 * lematy pytania z LLM → fragmenty raportów i innowacje z Zasobnika → odpowiedź tylko ze źródłami.
 * Bez źródeł albo przy pytaniu o własną sprawę asystent nie zgaduje, tylko przekazuje pytanie człowiekowi.
 */
export type FirstLine =
  | { outcome: "odpowiedz"; body: string; sources: MessageSource[] }
  /** reason: „sprawa” — pytanie o status, termin, decyzję; „brak_zrodel” — Zasobnik nie zna odpowiedzi albo AI nie działa. */
  | { outcome: "przekazano"; reason: "sprawa" | "brak_zrodel" }
  /** Wiadomość nie jest pytaniem (podziękowanie, uzupełnienie) — asystent milczy, przeczyta ją człowiek. */
  | { outcome: "bez_pytania" };

export const FORWARD_MESSAGES: Record<"sprawa" | "brak_zrodel", string> = {
  sprawa: "Pytanie dotyczy Twojej sprawy, więc nie zgaduję. Przekazałem pytanie do ROPS — pracownik odpowie tutaj, w tej rozmowie.",
  brak_zrodel: "W Zasobniku nie znalazłem pewnej odpowiedzi, więc nie zgaduję. Przekazałem pytanie do ROPS — pracownik odpowie tutaj, w tej rozmowie.",
};

/** `message` jest już zanonimizowana (lib/pii.ts). Błędy AI i bazy kończą się przekazaniem, nigdy wyjątkiem. */
export async function firstLine(message: string): Promise<FirstLine> {
  if (asksAboutOwnCase(message)) return { outcome: "przekazano", reason: "sprawa" };
  try {
    const { lemmas } = await tagCard("Pytanie do ROPS", message);
    const [chunks, innovationHits] = await Promise.all([
      searchDocChunks(lemmas, 5),
      keywordSearch("innowacja", lemmas, 3).then((hits) => hits.filter((h) => h.similarity >= NOVELTY_MIN_SIMILARITY)),
    ]);
    if (chunks.length === 0 && innovationHits.length === 0) return { outcome: "przekazano", reason: "brak_zrodel" };

    const ids = innovationHits.map((h) => h.ref_id);
    const supabase = createAdminClient();
    const [bodies, slugs] = ids.length
      ? await Promise.all([
          supabase.from("search_index").select("ref_id, body").eq("kind", "innowacja").in("ref_id", ids),
          supabase.from("innovations").select("id, slug").in("id", ids),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (bodies.error) throw bodies.error;
    if (slugs.error) throw slugs.error;
    const bodyById = new Map((bodies.data ?? []).map((b) => [b.ref_id as string, b.body as string]));
    const slugById = new Map((slugs.data ?? []).map((s) => [s.id as string, s.slug as string | null]));

    // Ta sama kolejność w obu listach: numer źródła z modelu wskazuje wpis w `stored`.
    const known: KnowledgeSource[] = [];
    const stored: MessageSource[] = [];
    for (const c of chunks) {
      known.push({ kind: "raport", docTitle: c.doc_title, year: c.year, page: c.page, text: c.text });
      stored.push({ kind: "raport", title: c.doc_title, year: c.year, page: c.page, href: c.url ? reportPageHref(c.url, c.page) : null });
    }
    for (const h of innovationHits) {
      known.push({ kind: "innowacja", title: h.title, text: bodyById.get(h.ref_id) ?? "" });
      stored.push({ kind: "innowacja", title: h.title, href: innovationHref(slugById.get(h.ref_id) ?? h.ref_id) });
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
