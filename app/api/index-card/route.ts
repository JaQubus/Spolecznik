import { isAdmin } from "@/lib/auth";
import { aiErrorResponse } from "@/lib/groq";
import { reindexCard } from "@/lib/index-card";
import { rateLimit } from "@/lib/rate-limit";
import { IndexCardRequest } from "@/lib/schemas";

/**
 * Reindeks karty po zapisie — tylko admin, bo każde wywołanie kosztuje zapytanie do LLM. Karty dopasowań
 * (inicjatywa, program, partner, rekord źródłowy) liczy lib/index-card.ts.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "index-card", 20);
  if (limited) return limited;
  if (!(await isAdmin())) return Response.json({ error: "Brak dostępu" }, { status: 403 });
  const body = await request.json().catch(() => null);

  const parsed = IndexCardRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Podaj rodzaj karty i jej identyfikator", issues: parsed.error.issues }, { status: 400 });
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
