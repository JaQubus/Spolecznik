import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { STATUS_CODE, ThreadPostRequest } from "@/lib/schemas";
import { authorView, authorizedThread, initiativeThread, mentorName, postAuthorMessage, THREAD_NOT_FOUND } from "@/lib/threads";

export async function GET(request: Request) {
  const limited = rateLimit(request, "threads-read", 60);
  if (limited) return limited;
  const code = new URL(request.url).searchParams.get("kod")?.trim().toUpperCase() ?? "";
  if (!STATUS_CODE.test(code)) return Response.json({ error: "Nieprawidłowy kod zgłoszenia" }, { status: 400 });
  try {
    const thread = await authorizedThread(code);
    if (!thread) return Response.json({ error: THREAD_NOT_FOUND }, { status: 404 });
    return Response.json(authorView(thread));
  } catch (e) {
    console.error("[threads]", e);
    return Response.json({ error: "Nie udało się wczytać rozmowy" }, { status: 500 });
  }
}

/**
 * Wiadomość od autora inicjatywy. Dane osobowe (telefony, e-maile, PESEL) usuwamy przed zapisem i przed wysłaniem do AI.
 * Potem asystent odpowiada z bazy wiedzy albo przekazuje pytanie zespołowi (lib/first-line.ts) — odpowiedź jest już w wątku.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "threads", 10);
  if (limited) return limited;
  const parsed = ThreadPostRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, { status: 400 });
  }
  const { code, body, mentorId } = parsed.data;

  try {
    const thread = await authorizedThread(code);
    if (!thread) return Response.json({ error: THREAD_NOT_FOUND }, { status: 404 });
    if (thread.status === "archived") {
      return Response.json({ error: "To zgłoszenie jest zamknięte. Jeśli inicjatywa ruszyła na nowo, zgłoś ją jeszcze raz" }, { status: 409 });
    }
    // Mentor z linku musi istnieć; przypisanego w Panelu autor nie zmienia.
    const chosen = mentorId && !thread.mentor && (await mentorName(mentorId)) ? mentorId : null;
    const clean = anonymize(body);
    // Osobny, ciaśniejszy limit na AI: po jego przekroczeniu wiadomość i tak trafia do zespołu, tylko bez asystenta.
    const assistant = rateLimit(request, "threads-ai", 5) === null;
    const { ai } = await postAuthorMessage(thread, clean.text, { mentorId: chosen, assistant });
    const updated = await initiativeThread({ code });
    return Response.json({ ...authorView(updated!), assistant: ai, removedPersonalData: clean.found });
  } catch (e) {
    console.error("[threads]", e);
    return Response.json({ error: "Nie udało się wysłać wiadomości" }, { status: 500 });
  }
}
