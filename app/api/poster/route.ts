import { aiErrorResponse } from "@/lib/groq";
import { ideaPoster } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { PosterRequest } from "@/lib/schemas";

/** Plakat pomysłu z Pracowni: fiszka + canvas → treść plakatu do narysowania w HTML/SVG. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "poster", 6);
  if (limited) return limited;
  const parsed = PosterRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Uzupełnij krótki opis pomysłu", issues: parsed.error.issues }, { status: 400 });
  }
  const { fiszka, canvas } = parsed.data;
  const clean = (text: string) => anonymize(text).text;

  try {
    const poster = await ideaPoster(
      {
        krotki_opis: clean(fiszka.krotki_opis),
        problem: clean(fiszka.problem),
        istota: clean(fiszka.istota),
        dla_kogo: clean(fiszka.dla_kogo),
        etap: fiszka.etap,
      },
      Object.fromEntries(Object.entries(canvas).filter(([, v]) => v.trim()).map(([k, v]) => [k, clean(v)])),
    );
    return Response.json({ poster });
  } catch (e) {
    return aiErrorResponse("poster", e, "Nie udało się przygotować plakatu");
  }
}
