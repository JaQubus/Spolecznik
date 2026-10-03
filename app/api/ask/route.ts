import { answerFromReports, tagCard } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { AskRequest, type AskResponse } from "@/lib/schemas";
import { searchDocChunks } from "@/lib/search";

const NO_ANSWER = "Raporty w Bibliotece nie zawierają odpowiedzi na to pytanie.";

/** Zapytaj Bibliotekę: RAG po fragmentach raportów, z odnośnikami do stron PDF. */
export async function POST(request: Request) {
  const parsed = AskRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const question = anonymize(parsed.data.question).text;

  try {
    // Słowa kluczowe pytania (z potocznymi synonimami) z LLM, potem wyszukiwanie po prefiksach w raportach.
    const { lemmas } = await tagCard("Pytanie do raportów", question);
    const hits = await searchDocChunks(lemmas, 6);
    if (hits.length === 0) {
      return Response.json({ answered: false, answer: NO_ANSWER, sources: [] } satisfies AskResponse);
    }
    const result = await answerFromReports(
      question,
      hits.map((h) => ({ docTitle: h.doc_title, year: h.year, page: h.page, text: h.text })),
    );
    const response: AskResponse = {
      answered: result.answered,
      answer: result.answered ? result.answer : NO_ANSWER,
      sources: result.answered
        ? result.sources.map((n) => ({ docTitle: hits[n].doc_title, year: hits[n].year, url: hits[n].url, page: hits[n].page }))
        : [],
    };
    return Response.json(response);
  } catch (e) {
    console.error("[ask]", e);
    return Response.json({ error: "Nie udało się odpowiedzieć na pytanie" }, { status: 500 });
  }
}
