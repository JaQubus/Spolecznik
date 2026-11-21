import { searchChallenge } from "@/lib/challenge-search";
import { aiErrorResponse } from "@/lib/groq";
import { rateLimit } from "@/lib/rate-limit";
import { ChallengeRequest } from "@/lib/schemas";

/** „Szukam rozwiązania”: wyzwanie instytucji → inicjatywy z regionu i sprawdzone rozwiązania z Polski. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "challenges", 6);
  if (limited) return limited;
  const parsed = ChallengeRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    return Response.json(await searchChallenge(parsed.data));
  } catch (e) {
    return aiErrorResponse("challenges", e, "Nie udało się wyszukać rozwiązań");
  }
}
