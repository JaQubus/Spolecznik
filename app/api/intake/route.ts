import { intake } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { CLARITY_THRESHOLD, IntakeRequest } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { aiErrorResponse } from "@/lib/groq";

export async function POST(request: Request) {
  const limited = rateLimit(request, "intake", 10);
  if (limited) return limited;
  const parsed = IntakeRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { text, gmina, previousCard } = parsed.data;
  const { text: clean, found: piiFound } = anonymize(gmina ? `${text}\nGmina: ${gmina}` : text);

  try {
    const card = await intake(clean, previousCard);
    // Najwyżej jedno dopytanie: przy odpowiedzi na pytanie już nie dopytujemy.
    const needsFollowUp = !previousCard && card.clarity < CLARITY_THRESHOLD && !!card.followUp;
    return Response.json({ card, needsFollowUp, piiFound });
  } catch (e) {
    return aiErrorResponse("intake", e, "Nie udało się przeanalizować opisu");
  }
}
