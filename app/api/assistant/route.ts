import { assistantReply, tagCard, type SimilarItem } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { AssistantRequest, NOVELTY_MIN_SIMILARITY, type AssistantResponse } from "@/lib/schemas";
import { keywordSearch } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { aiErrorResponse } from "@/lib/groq";

/** Asystent Pracowni: pytania, nieoczywiste kierunki i sprawdzanie nowości tym samym silnikiem co Dopasuj. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "assistant", 15);
  if (limited) return limited;
  const parsed = AssistantRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const messages = parsed.data.messages.map((m) => ({ ...m, content: anonymize(m.content).text }));
  const fiszka = parsed.data.fiszka && {
    krotki_opis: anonymize(parsed.data.fiszka.krotki_opis).text,
    problem: anonymize(parsed.data.fiszka.problem).text,
    istota: anonymize(parsed.data.fiszka.istota).text,
    dla_kogo: anonymize(parsed.data.fiszka.dla_kogo).text,
    etap: parsed.data.fiszka.etap,
  };

  try {
    // Nowość sprawdzamy po fiszce, a bez niej po wiadomościach autora — po lematach, jak Dopasuj.
    const ideaText = fiszka
      ? `${fiszka.problem}\n${fiszka.istota}\n${fiszka.dla_kogo}`
      : messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
    const { lemmas } = await tagCard(fiszka?.krotki_opis ?? "Pomysł", ideaText);
    const [innovationHits, ideaHits] = await Promise.all([
      keywordSearch("innowacja", lemmas, 3),
      keywordSearch("pomysl", lemmas, 3),
    ]);
    const hits = [
      ...innovationHits.map((h) => ({ ...h, kind: "innowacja" as const })),
      ...ideaHits.map((h) => ({ ...h, kind: "pomysl" as const })),
    ].filter((h) => h.similarity >= NOVELTY_MIN_SIMILARITY);

    const supabase = createAdminClient();
    const innovationIds = hits.filter((h) => h.kind === "innowacja").map((h) => h.ref_id);
    const [{ data: bodies, error }, { data: slugs, error: slugError }] = await Promise.all([
      hits.length
        ? supabase.from("search_index").select("kind, ref_id, body").in("ref_id", hits.map((h) => h.ref_id))
        : Promise.resolve({ data: [], error: null }),
      innovationIds.length
        ? supabase.from("innovations").select("id, slug").in("id", innovationIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (error) throw error;
    if (slugError) throw slugError;
    const bodyByKey = new Map((bodies ?? []).map((b) => [`${b.kind}:${b.ref_id}`, b.body as string]));
    const slugById = new Map((slugs ?? []).map((s) => [s.id as string, s.slug as string | null]));
    const similar: SimilarItem[] = hits.map((h) => ({
      kind: h.kind,
      title: h.title,
      body: bodyByKey.get(`${h.kind}:${h.ref_id}`) ?? "",
      similarity: h.similarity,
    }));

    const reply = await assistantReply(messages, fiszka, similar);
    const response: AssistantResponse = {
      reply,
      similar: hits.map((h) => ({
        kind: h.kind, id: h.ref_id, title: h.title, similarity: h.similarity, slug: slugById.get(h.ref_id) ?? null,
      })),
    };
    return Response.json(response);
  } catch (e) {
    return aiErrorResponse("assistant", e, "Asystent nie odpowiedział, spróbuj ponownie");
  }
}
