import { intake } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { CLARITY_THRESHOLD, IntakeRequest } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { AREA_LABELS } from "@/lib/taxonomy";

export async function POST(request: Request) {
  const limited = rateLimit(request, "intake", 10);
  if (limited) return limited;
  const parsed = IntakeRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { text, gmina, area, previousCard } = parsed.data;
  const context = [gmina && `Gmina: ${gmina}`, area && `Obszar: ${AREA_LABELS[area]}`].filter(Boolean).join("\n");
  const { text: clean, found: piiFound } = anonymize(context ? `${text}\n${context}` : text);

  try {
    const card = await intake(clean, previousCard);
    // Obszar wybrany przez użytkownika (np. ze strony obszaru w Bibliotece) zawsze trafia na kartę.
    if (area && !card.areas.includes(area)) card.areas = [area, ...card.areas].slice(0, 3);
    // Najwyżej jedno dopytanie: przy odpowiedzi na pytanie już nie dopytujemy.
    const needsFollowUp = !previousCard && card.clarity < CLARITY_THRESHOLD && !!card.followUp;
    return Response.json({ card, needsFollowUp, piiFound });
  } catch (e) {
    console.error("[intake]", e);
    return Response.json({ error: "Nie udało się przeanalizować opisu" }, { status: 500 });
  }
}
