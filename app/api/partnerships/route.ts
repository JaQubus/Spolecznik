import { z } from "zod";
import { isMember, partnershipMessages, postPartnershipMessage } from "@/lib/partnerships";
import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { STATUS_CODE } from "@/lib/schemas";
import { canOpen, initiativeThread } from "@/lib/threads";

const PRIVATE = "Nie możemy otworzyć tej rozmowy. Otwórz ją na urządzeniu, z którego wysłano zgłoszenie, albo prywatnym linkiem";

const PostRequest = z.object({
  code: z.string().regex(STATUS_CODE),
  threadId: z.uuid(),
  body: z.string().trim().min(2, "Wpisz wiadomość").max(2000, "Wiadomość może mieć najwyżej 2000 znaków"),
});

/**
 * Partnerstwo widzi tylko inicjatywa, która przyjęła zaproszenie (albo sama zaprasza), i tylko z kluczem w ciasteczku.
 * Brak inicjatywy, brak klucza i brak zgody dają tę samą odpowiedź.
 */
async function member(code: string, threadId: string): Promise<string | null> {
  const initiative = await initiativeThread({ code });
  if (!initiative || !(await canOpen(initiative))) return null;
  return (await isMember(initiative.id, threadId)) ? initiative.id : null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "partnerships-read", 60);
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const code = params.get("kod")?.trim().toUpperCase() ?? "";
  const threadId = params.get("watek") ?? "";
  if (!STATUS_CODE.test(code) || !z.uuid().safeParse(threadId).success) {
    return Response.json({ error: "Nieprawidłowy adres rozmowy" }, { status: 400 });
  }
  try {
    const initiativeId = await member(code, threadId);
    if (!initiativeId) return Response.json({ error: PRIVATE }, { status: 404 });
    return Response.json({ threadId, messages: await partnershipMessages(threadId, initiativeId) });
  } catch (e) {
    console.error("[partnerships]", e);
    return Response.json({ error: "Nie udało się wczytać rozmowy" }, { status: 500 });
  }
}

/** Wiadomość autora. Dane osobowe usuwamy przed zapisem — czytają ją autorzy innych inicjatyw, nie tylko zespół. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "partnerships", 10);
  if (limited) return limited;
  const parsed = PostRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, { status: 400 });
  }
  const { code, threadId, body } = parsed.data;
  try {
    const initiativeId = await member(code, threadId);
    if (!initiativeId) return Response.json({ error: PRIVATE }, { status: 404 });
    const clean = anonymize(body);
    await postPartnershipMessage(threadId, { initiativeId }, clean.text);
    return Response.json({ threadId, messages: await partnershipMessages(threadId, initiativeId), removedPersonalData: clean.found });
  } catch (e) {
    console.error("[partnerships]", e);
    return Response.json({ error: "Nie udało się wysłać wiadomości" }, { status: 500 });
  }
}
