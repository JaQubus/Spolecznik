import { aiErrorResponse } from "@/lib/groq";
import { intakeChallenge, intakeInitiative } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { CLARITY_THRESHOLD, IntakeRequest } from "@/lib/schemas";

/**
 * Opis → karta. Tryby: own (zgłaszam swoją inicjatywę), nomination (wskazuję cudzą), challenge („Szukam rozwiązania”).
 * Dane osobowe usuwamy przed wysłaniem do modelu. Najwyżej jedna runda dopytania: przy odpowiedzi już nie dopytujemy.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "intake", 10);
  if (limited) return limited;
  const parsed = IntakeRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { text, gmina } = parsed.data;
  const { text: clean, found: piiFound } = anonymize(gmina ? `${text}\nGmina: ${gmina}` : text);

  try {
    if (parsed.data.mode === "challenge") {
      const previous = parsed.data.previousCard;
      const card = await intakeChallenge(clean, previous);
      const followUps = !previous && card.clarity < CLARITY_THRESHOLD && card.followUp ? [card.followUp] : [];
      return Response.json({ mode: "challenge", card, followUps, piiFound });
    }
    const previous = parsed.data.previousCard;
    const card = await intakeInitiative(clean, parsed.data.mode, previous);
    const followUps = !previous && card.clarity < CLARITY_THRESHOLD ? card.followUps.slice(0, 2) : [];
    return Response.json({ mode: parsed.data.mode, card, followUps, piiFound });
  } catch (e) {
    return aiErrorResponse("intake", e, "Nie udało się przeanalizować opisu");
  }
}
