import { aiErrorResponse } from "@/lib/groq";
import { meritReview } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { MeritRequest } from "@/lib/schemas";
import { frameworkContext } from "@/lib/usluga-wrazliwa";

/**
 * Podpowiedzi do szkicu wniosku „Usługa Wrażliwa” według karty oceny merytorycznej (#105).
 * Dostaje tylko część merytoryczną (bez danych wnioskodawcy) i nic nie zapisuje: szkic żyje w przeglądarce.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "wniosek-uw-ocena", 5);
  if (limited) return limited;
  const parsed = MeritRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;
  // Wolny tekst idzie do modelu, więc bez danych osobowych (lib/pii.ts), jak w innych trasach.
  const sections = Object.fromEntries(
    Object.entries(input.sections).map(([k, v]) => [k, anonymize(v).text]),
  ) as MeritRequest["sections"];

  try {
    const review = await meritReview({ ...input, sections }, frameworkContext(input.innovationSlug));
    return Response.json(review);
  } catch (e) {
    return aiErrorResponse("wniosek-uw-ocena", e, "Nie udało się ocenić szkicu wniosku");
  }
}
