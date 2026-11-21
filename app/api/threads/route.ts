import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { STATUS_CODE, ThreadPostRequest } from "@/lib/schemas";
import { authorView, authorizedThread, expertName, needThread, postAuthorMessage, THREAD_NOT_FOUND } from "@/lib/threads";

export async function GET(request: Request) {
  const limited = rateLimit(request, "rozmowy-odczyt", 60);
  if (limited) return limited;
  const code = new URL(request.url).searchParams.get("kod")?.trim().toUpperCase() ?? "";
  if (!STATUS_CODE.test(code)) return Response.json({ error: "Nieprawidłowy kod zgłoszenia" }, { status: 400 });
  try {
    const thread = await authorizedThread(code);
    if (!thread) return Response.json({ error: THREAD_NOT_FOUND }, { status: 404 });
    return Response.json(authorView(thread));
  } catch (e) {
    console.error("[rozmowy]", e);
    return Response.json({ error: "Nie udało się wczytać rozmowy" }, { status: 500 });
  }
}

/**
 * Wiadomość od autora zgłoszenia. Dane osobowe (telefony, e-maile, PESEL) usuwamy przed zapisem i przed wysłaniem do AI.
 * Potem asystent odpowiada z Zasobnika albo przekazuje pytanie do ROPS (lib/first-line.ts) — odpowiedź jest już w wątku.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "rozmowy", 10);
  if (limited) return limited;
  const parsed = ThreadPostRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, { status: 400 });
  }
  const { code, body, expertId } = parsed.data;

  try {
    const thread = await authorizedThread(code);
    if (!thread) return Response.json({ error: THREAD_NOT_FOUND }, { status: 404 });
    if (thread.status === "zamkniete") {
      const error = thread.kind === "pomysl"
        ? "Ten pomysł jest zamknięty. Jeśli chcesz wrócić do tematu, zgłoś go jeszcze raz"
        : "To zgłoszenie jest zamknięte. Jeśli problem wrócił, opisz go jeszcze raz";
      return Response.json({ error }, { status: 409 });
    }
    // Ekspert z linku musi istnieć w indeksie; przypisanego w Panelu autor nie zmienia.
    const chosen = expertId && !thread.expert && (await expertName(expertId)) ? expertId : null;
    const clean = anonymize(body);
    // Osobny, ciaśniejszy limit na AI: po jego przekroczeniu wiadomość i tak trafia do ROPS, tylko bez asystenta.
    const assistant = rateLimit(request, "rozmowy-ai", 5) === null;
    const { ai } = await postAuthorMessage(thread, clean.text, { expertId: chosen, assistant });
    const updated = await needThread({ code });
    return Response.json({ ...authorView(updated!), assistant: ai, removedPersonalData: clean.found });
  } catch (e) {
    console.error("[rozmowy]", e);
    return Response.json({ error: "Nie udało się wysłać wiadomości" }, { status: 500 });
  }
}
