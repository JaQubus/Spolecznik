import { rateLimit } from "@/lib/rate-limit";
import { ThreadNotHelpfulRequest } from "@/lib/schemas";
import { authorizedThread, authorView, markNotHelpful, needThread, THREAD_NOT_FOUND } from "@/lib/threads";

/** „To nie odpowiada na moje pytanie”: autor oznacza odpowiedź asystenta jako niepomocną, rozmowa trafia w Panelu na górę. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "rozmowy-pilne", 5);
  if (limited) return limited;
  const parsed = ThreadNotHelpfulRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nieprawidłowy kod zgłoszenia" }, { status: 400 });

  try {
    const thread = await authorizedThread(parsed.data.code);
    if (!thread) return Response.json({ error: THREAD_NOT_FOUND }, { status: 404 });
    if (thread.status === "zamkniete") return Response.json({ error: "To zgłoszenie jest zamknięte" }, { status: 409 });
    if (!(await markNotHelpful(thread))) {
      return Response.json({ error: "W tej rozmowie nie ma odpowiedzi asystenta" }, { status: 409 });
    }
    const updated = await needThread({ code: parsed.data.code });
    return Response.json(authorView(updated!));
  } catch (e) {
    console.error("[rozmowy] pilne:", e);
    return Response.json({ error: "Nie udało się przekazać pytania" }, { status: 500 });
  }
}
