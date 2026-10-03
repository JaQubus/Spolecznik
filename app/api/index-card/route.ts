import { reindexCard } from "@/lib/index-card";
import { IndexCardRequest } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { aiErrorResponse } from "@/lib/groq";

/** Reindeks karty po zapisie w Panelu albo Pracowni (README 5.3). */
export async function POST(request: Request) {
  const limited = rateLimit(request, "index-card", 20);
  if (limited) return limited;
  const parsed = IndexCardRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { kind, refId } = parsed.data;
  try {
    if (!(await reindexCard(kind, refId))) {
      return Response.json({ error: "Nie znaleziono karty" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return aiErrorResponse("index-card", e, "Nie udało się zaktualizować indeksu");
  }
}
