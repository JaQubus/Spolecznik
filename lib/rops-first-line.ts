import "server-only";
import { relatedKnowledge } from "./knowledge/search";
import { ropsFirstLine, type ZasobnikItem } from "./llm";
import { createAdminClient } from "./supabase/admin";
import { postNeedMessage, type NeedThread } from "./threads";

/**
 * „Zapytaj ROPS” (README §6): asystent AI odpowiada z Zasobnika jako pierwsza linia i przekazuje sprawę człowiekowi.
 * Odpowiada tylko, dopóki w rozmowie nie odezwał się pracownik ROPS ani ekspert — potem rozmawiają ludzie.
 * Linki zapisujemy jako [tytuł](adres); MessageList zamienia je na odnośniki tylko w wiadomościach AI.
 */

export const HANDOFF = "To automatyczna odpowiedź. Rozmowę widzi też pracownik ROPS — jeśli trzeba, odpowie tutaj.";
export const NO_ANSWER =
  "Nie znalazłem odpowiedzi w Zasobniku. Przekazałem Twoją wiadomość pracownikowi ROPS — odpowie w tej rozmowie.";

const clip = (s: string | null | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)}…` : s ?? "");

type Source = ZasobnikItem & { href: string };

/** Kontekst dla asystenta: karta potrzeby (skrót i słowa kluczowe) albo fiszka pomysłu (krótki opis). */
async function reportContext(t: NeedThread): Promise<{ summary: string; keywords: string[] }> {
  const supabase = createAdminClient();
  if (t.kind === "pomysl") {
    const { data, error } = await supabase.from("ideas").select("fiszka").eq("id", t.id).maybeSingle();
    if (error) throw error;
    const fiszka = (data?.fiszka ?? {}) as { krotki_opis?: string };
    return { summary: fiszka.krotki_opis ?? "", keywords: [] };
  }
  const { data, error } = await supabase.from("needs").select("card").eq("id", t.id).maybeSingle();
  if (error) throw error;
  const card = (data?.card ?? {}) as { summary?: string; keywords?: string[] };
  return { summary: card.summary ?? "", keywords: card.keywords ?? [] };
}

/** Treść wiadomości AI albo null, gdy asystent ma milczeć. `message` musi być już zanonimizowana. */
export async function firstLineBody(t: NeedThread, message: string): Promise<string | null> {
  if (t.messages.some((m) => m.role === "rops" || m.role === "ekspert")) return null;
  // Bez odpowiedzi z Zasobnika informujemy o przekazaniu tylko raz, a nie po każdej wiadomości —
  // ale wcześniejsza odpowiedź merytoryczna nie liczy się jako przekazanie.
  const handoffOnce = () => (t.messages.some((m) => m.role === "ai" && m.body === NO_ANSWER) ? null : NO_ANSWER);

  const need = await reportContext(t);
  const found = await relatedKnowledge(`${message} ${need.keywords.join(" ")}`);
  const sources: Source[] = [
    ...found.innovations.map((i) => ({
      title: i.title,
      body: clip([i.problem, i.solution].filter(Boolean).join(" "), 500),
      href: `/biblioteka/innowacja/${i.slug}`,
    })),
    ...found.materials.map((m) => ({ title: m.title, body: clip(m.description, 300), href: m.url })),
  ];
  if (sources.length === 0) return handoffOnce();

  const reply = await ropsFirstLine(message, need.summary, sources);
  if (!reply.answered) return handoffOnce();

  const links = reply.sources.map((n) => `- [${sources[n].title}](${sources[n].href})`).join("\n");
  return `${reply.answer.trim()}\n\nW Zasobniku:\n${links}\n\n${HANDOFF}`;
}

/** Odpowiedź asystenta w wątku. Błąd AI nie blokuje rozmowy — wiadomość autora i tak trafia do ROPS. */
export async function replyFirstLine(t: NeedThread, message: string): Promise<boolean> {
  try {
    const body = await firstLineBody(t, message);
    if (!body) return false;
    await postNeedMessage(t, { role: "ai", body });
    return true;
  } catch (e) {
    console.error("[rozmowy] asystent AI:", e);
    return false;
  }
}
