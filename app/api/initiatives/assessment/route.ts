import { z } from "zod";
import { authorAssessment } from "@/lib/initiatives/assessment";
import { rateLimit } from "@/lib/rate-limit";
import { STATUS_CODE } from "@/lib/schemas";

// Klucz w treści POST, nie w adresie: adresy trafiają do logów serwera i historii przeglądarki.
const Body = z.object({ code: z.string().regex(STATUS_CODE), key: z.string().max(64), pathways: z.boolean().optional() });

/** Stan oceny radaru dla autora (ekran wyniku i strona statusu dopytują co kilka sekund). Bez wywołań modelu. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "assessment", 40);
  if (limited) return limited;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  try {
    const result = await authorAssessment(parsed.data.code, parsed.data.key, { withPathways: parsed.data.pathways });
    if (!result) return Response.json({ error: "Nie znaleźliśmy zgłoszenia" }, { status: 404 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[ocena dla autora]", e);
    return Response.json({ error: "Nie udało się sprawdzić oceny" }, { status: 500 });
  }
}
