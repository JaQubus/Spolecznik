import { aiErrorResponse } from "@/lib/groq";
import { assistantReply, tagCard, type SimilarItem } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { AssistantRequest, NOVELTY_MIN_SIMILARITY, type AssistantResponse } from "@/lib/schemas";
import { keywordSearch } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Asystent warsztatu: pytania, nieoczywiste kierunki i sprawdzanie nowości po lematach — wśród sprawdzonych
 * rozwiązań i opublikowanych inicjatyw (nieopublikowanych zgłoszeń nie pokazujemy innym autorom).
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "assistant", 15);
  if (limited) return limited;
  const parsed = AssistantRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const clean = (s: string) => anonymize(s).text;
  const messages = parsed.data.messages.map((m) => ({ ...m, content: clean(m.content) }));
  const s = parsed.data.sketch;
  const sketch = s && {
    summary: clean(s.summary), problem: clean(s.problem), solution: clean(s.solution),
    beneficiaries: clean(s.beneficiaries), stage: s.stage,
  };

  try {
    // Nowość sprawdzamy po szkicu, a bez niego po wiadomościach autora.
    const text = sketch
      ? `${sketch.problem}\n${sketch.solution}\n${sketch.beneficiaries}`
      : messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
    const { lemmas } = await tagCard(sketch?.summary ?? "Pomysł", text);
    const supabase = createAdminClient();
    const initiativeHits = await keywordSearch("initiative", lemmas, 6);
    const relevant = <T extends { similarity: number }>(hits: T[]) => hits.filter((h) => h.similarity >= NOVELTY_MIN_SIMILARITY);

    const initiativeIds = relevant(initiativeHits).map((h) => h.ref_id);
    const { data: initiatives, error } = initiativeIds.length
      ? await supabase.from("public_initiatives").select("id, slug, title, summary").in("id", initiativeIds)
      : { data: [], error: null };
    if (error) throw error;

    const sim = new Map(initiativeHits.map((h) => [h.ref_id, h.similarity]));
    const found = [
      ...(initiatives ?? []).slice(0, 3).map((i) => ({
        kind: "initiative" as const, id: i.id as string, title: i.title as string, slug: i.slug as string | null, body: i.summary as string,
      })),
    ];
    const similar: SimilarItem[] = found.map((f) => ({ kind: f.kind, title: f.title, body: f.body, similarity: sim.get(f.id) ?? 0 }));

    const reply = await assistantReply(messages, sketch, similar);
    const response: AssistantResponse = {
      reply,
      similar: found.map((f) => ({ kind: f.kind, id: f.id, title: f.title, similarity: sim.get(f.id) ?? 0, slug: f.slug })),
    };
    return Response.json(response);
  } catch (e) {
    return aiErrorResponse("assistant", e, "Asystent nie odpowiedział, spróbuj ponownie");
  }
}
