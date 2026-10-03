import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { STATUS_CODE, ThreadPostRequest } from "@/lib/schemas";
import { expertName, needThread, postNeedMessage, type NeedThread } from "@/lib/threads";

/** Tylko to, co może zobaczyć posiadacz kodu: bez id autora i bez id zgłoszenia. */
function view(t: NeedThread) {
  return { threadId: t.threadId, status: t.status, expert: t.expert, messages: t.messages };
}

/** Wątek zgłoszenia po kodzie SPL-…. Limit chroni przed zgadywaniem kodów. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "rozmowy-odczyt", 60);
  if (limited) return limited;
  const code = new URL(request.url).searchParams.get("kod")?.trim().toUpperCase() ?? "";
  if (!STATUS_CODE.test(code)) return Response.json({ error: "Nieprawidłowy kod zgłoszenia" }, { status: 400 });
  try {
    const thread = await needThread({ code });
    if (!thread) return Response.json({ error: "Nie znaleźliśmy zgłoszenia o tym kodzie" }, { status: 404 });
    return Response.json(view(thread));
  } catch (e) {
    console.error("[rozmowy]", e);
    return Response.json({ error: "Nie udało się wczytać rozmowy" }, { status: 500 });
  }
}

/** Wiadomość od autora zgłoszenia. Dane osobowe (telefony, e-maile, PESEL) usuwamy przed zapisem. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "rozmowy", 10);
  if (limited) return limited;
  const parsed = ThreadPostRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, { status: 400 });
  }
  const { code, body, expertId } = parsed.data;

  try {
    const thread = await needThread({ code });
    if (!thread) return Response.json({ error: "Nie znaleźliśmy zgłoszenia o tym kodzie" }, { status: 404 });
    if (thread.status === "zamkniete") {
      return Response.json({ error: "To zgłoszenie jest zamknięte. Jeśli problem wrócił, opisz go jeszcze raz" }, { status: 409 });
    }
    // Ekspert z linku musi istnieć w indeksie; przypisanego w Panelu autor nie zmienia.
    const chosen = expertId && !thread.expert && (await expertName(expertId)) ? expertId : null;
    const clean = anonymize(body);
    await postNeedMessage(thread, { role: "autor", body: clean.text, expertId: chosen });
    const updated = await needThread({ code });
    return Response.json({ ...view(updated!), removedPersonalData: clean.found });
  } catch (e) {
    console.error("[rozmowy]", e);
    return Response.json({ error: "Nie udało się wysłać wiadomości" }, { status: 500 });
  }
}
