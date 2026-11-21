import { aiErrorResponse } from "@/lib/groq";
import { currentUserId, rememberInitiative } from "@/lib/initiatives/access";
import { createInitiative } from "@/lib/initiatives/create";
import { rateLimit } from "@/lib/rate-limit";
import { InitiativeRequest, normalizeCard } from "@/lib/schemas";

/** Zgłoszenie albo wskazanie po intake: zapis z kodem i kluczem, wyniki (podobne inicjatywy, ścieżki z partnerami, programy). */
export async function POST(request: Request) {
  const limited = rateLimit(request, "initiatives", 6);
  if (limited) return limited;
  const parsed = InitiativeRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const result = await createInitiative({ ...parsed.data, card: normalizeCard(parsed.data.card), authorId: await currentUserId() });
    // Ta przeglądarka zapamiętuje zgłoszenie — /rozmowy i /status pokażą je bez wpisywania kodu.
    await rememberInitiative(result.initiative.statusCode, result.initiative.accessKey);
    return Response.json(result);
  } catch (e) {
    return aiErrorResponse("initiatives", e, "Nie udało się zapisać zgłoszenia");
  }
}
