import { runMatch } from "@/lib/match";
import { MatchRequest } from "@/lib/schemas";

export async function POST(request: Request) {
  const parsed = MatchRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    return Response.json(await runMatch(parsed.data));
  } catch (e) {
    console.error("[match]", e);
    return Response.json({ error: "Nie udało się wyszukać rozwiązań" }, { status: 500 });
  }
}
