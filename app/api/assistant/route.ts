import { assistantReply, type SimilarItem } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { AssistantRequest, NOVELTY_MIN_SIMILARITY, type AssistantResponse } from "@/lib/schemas";
import { embedText, hybridSearch } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

/** Asystent Pracowni: pytania, nieoczywiste kierunki i sprawdzanie nowości tym samym silnikiem co Dopasuj. */
export async function POST(request: Request) {
  const parsed = AssistantRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const messages = parsed.data.messages.map((m) => ({ ...m, content: anonymize(m.content).text }));
  const fiszka = parsed.data.fiszka && {
    summary: anonymize(parsed.data.fiszka.summary).text,
    essence: anonymize(parsed.data.fiszka.essence).text,
    audience: anonymize(parsed.data.fiszka.audience).text,
    stage: parsed.data.fiszka.stage,
  };

  try {
    // Nowość sprawdzamy po fiszce, a bez niej po wiadomościach autora.
    const ideaText = fiszka
      ? `${fiszka.summary}\n${fiszka.essence}\n${fiszka.audience}`
      : messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
    const embedding = await embedText(ideaText);
    const [innovationHits, ideaHits] = await Promise.all([
      hybridSearch("innowacja", [], embedding, 3),
      hybridSearch("pomysl", [], embedding, 3),
    ]);
    const hits = [
      ...innovationHits.map((h) => ({ ...h, kind: "innowacja" as const })),
      ...ideaHits.map((h) => ({ ...h, kind: "pomysl" as const })),
    ].filter((h) => h.similarity >= NOVELTY_MIN_SIMILARITY);

    const { data: bodies, error } = hits.length
      ? await createAdminClient().from("search_index").select("kind, ref_id, body")
          .in("ref_id", hits.map((h) => h.ref_id))
      : { data: [], error: null };
    if (error) throw error;
    const bodyByKey = new Map((bodies ?? []).map((b) => [`${b.kind}:${b.ref_id}`, b.body as string]));
    const similar: SimilarItem[] = hits.map((h) => ({
      kind: h.kind,
      title: h.title,
      body: bodyByKey.get(`${h.kind}:${h.ref_id}`) ?? "",
      similarity: h.similarity,
    }));

    const reply = await assistantReply(messages, fiszka, similar);
    const response: AssistantResponse = {
      reply,
      similar: hits.map((h) => ({ kind: h.kind, id: h.ref_id, title: h.title, similarity: h.similarity })),
    };
    return Response.json(response);
  } catch (e) {
    console.error("[assistant]", e);
    return Response.json({ error: "Asystent nie odpowiedział, spróbuj ponownie" }, { status: 500 });
  }
}
