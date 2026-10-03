import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { STATUS_CODE, ThreadPostRequest } from "@/lib/schemas";
import { canOpen, expertName, needThread, postNeedMessage, type NeedThread } from "@/lib/threads";

const NOT_FOUND = "Nie znaleźliśmy zgłoszenia o tym kodzie";
const PRIVATE = "Ta rozmowa jest prywatna. Otwórz ją na urządzeniu, z którego wysłano zgłoszenie, albo prywatnym linkiem";

/** Tylko to, co widzi autor: bez id zgłoszenia, id autora i skrótu klucza. */
function view(t: NeedThread) {
  return { threadId: t.threadId, status: t.status, expert: t.expert, messages: t.messages };
}

/**
 * Wątek tylko dla przeglądarki z kluczem (ciasteczko httpOnly, lib/need-access.ts).
 * Brak zgłoszenia i brak klucza dają tę samą odpowiedź, żeby po odpowiedzi nie dało się sprawdzać, które kody istnieją.
 */
async function authorized(code: string): Promise<NeedThread | null> {
  const thread = await needThread({ code });
  return thread && (await canOpen(thread)) ? thread : null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "rozmowy-odczyt", 60);
  if (limited) return limited;
  const code = new URL(request.url).searchParams.get("kod")?.trim().toUpperCase() ?? "";
  if (!STATUS_CODE.test(code)) return Response.json({ error: "Nieprawidłowy kod zgłoszenia" }, { status: 400 });
  try {
    const thread = await authorized(code);
    if (!thread) return Response.json({ error: `${NOT_FOUND}. ${PRIVATE}` }, { status: 404 });
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
    const thread = await authorized(code);
    if (!thread) return Response.json({ error: `${NOT_FOUND}. ${PRIVATE}` }, { status: 404 });
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
