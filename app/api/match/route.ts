import { runMatch } from "@/lib/match";
import { MatchRequest } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { aiErrorResponse } from "@/lib/groq";

export async function POST(request: Request) {
  const limited = rateLimit(request, "match", 6);
  if (limited) return limited;
  const parsed = MatchRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    return Response.json(await runMatch(parsed.data));
  } catch (e) {
    return aiErrorResponse("match", e, "Nie udało się wyszukać rozwiązań");
  }
}
