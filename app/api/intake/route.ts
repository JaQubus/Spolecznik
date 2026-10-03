import { intake } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { CLARITY_THRESHOLD, IntakeRequest } from "@/lib/schemas";

export async function POST(request: Request) {
  const parsed = IntakeRequest.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { text, gmina, previousCard } = parsed.data;
  const { text: clean, found: piiFound } = anonymize(gmina ? `${text}\nGmina: ${gmina}` : text);

  const card = await intake(clean, previousCard);
  // Najwyżej jedno dopytanie: przy odpowiedzi na pytanie już nie dopytujemy.
  const needsFollowUp = !previousCard && card.clarity < CLARITY_THRESHOLD && !!card.followUp;

  return Response.json({ card, needsFollowUp, piiFound });
}
