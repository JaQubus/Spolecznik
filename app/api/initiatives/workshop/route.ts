import { aiErrorResponse } from "@/lib/groq";
import type { z } from "zod";
import { currentUserId, rememberInitiative } from "@/lib/initiatives/access";
import { createInitiative } from "@/lib/initiatives/create";
import { intakeInitiative } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { WorkshopRequest } from "@/lib/schemas";

/** Tekst szkicu i kanwy dla intake — te same pola, które autor widzi w warsztacie. */
function sketchText(sketch: z.infer<typeof WorkshopRequest>["sketch"], canvas: Record<string, string>): string {
  return [
    sketch.summary,
    sketch.problem && `Problem: ${sketch.problem}`,
    sketch.solution && `Rozwiązanie: ${sketch.solution}`,
    sketch.beneficiaries && `Dla kogo: ${sketch.beneficiaries}`,
    sketch.stage && `Etap: ${sketch.stage}`,
    ...Object.entries(canvas).filter(([, v]) => v.trim()).map(([k, v]) => `${k}: ${v}`),
  ].filter(Boolean).join("\n");
}

/** Zgłoszenie z warsztatu (/zglos/warsztat): kartę robi serwer z intake na szkicu, plakat i kanwa idą razem z nią. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "workshop", 5);
  if (limited) return limited;
  const parsed = WorkshopRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Uzupełnij krótki opis pomysłu", issues: parsed.error.issues }, { status: 400 });
  }
  const { sketch, canvas, poster } = parsed.data;
  const text = sketchText(sketch, canvas);
  try {
    const card = await intakeInitiative(anonymize(text).text, "own");
    const result = await createInitiative({ kind: "own", card, text, canvas, poster, authorId: await currentUserId() });
    await rememberInitiative(result.initiative.statusCode, result.initiative.accessKey);
    return Response.json(result);
  } catch (e) {
    return aiErrorResponse("workshop", e, "Nie udało się zapisać pomysłu");
  }
}
