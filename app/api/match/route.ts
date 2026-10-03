import { runMatch } from "@/lib/match";
import { rememberNeed } from "@/lib/need-access";
import { MatchRequest } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimit(request, "match", 6);
  if (limited) return limited;
  const parsed = MatchRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const result = await runMatch(parsed.data);
    // Ta przeglądarka zapamiętuje zgłoszenie — /zapytaj pokaże je bez wpisywania kodu.
    await rememberNeed(result.need.statusCode, result.need.accessKey);
    return Response.json(result);
  } catch (e) {
    console.error("[match]", e);
    return Response.json({ error: "Nie udało się wyszukać rozwiązań" }, { status: 500 });
  }
}
