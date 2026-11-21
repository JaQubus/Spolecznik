"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isAssigned, requireExpert } from "@/lib/expert";
import { STATUS_CODE } from "@/lib/schemas";
import { needThread, postNeedMessage } from "@/lib/threads";

export type ReplyResult = { ok: boolean; message: string } | null;

const ReplyInput = z.object({ code: z.string().regex(STATUS_CODE), body: z.string().trim().min(2).max(2000) });

/** Odpowiedź eksperta w rozmowie — tylko przy zgłoszeniu albo pomyśle przypisanym do niego (#63). */
export async function replyAsExpert(_prev: ReplyResult, formData: FormData): Promise<ReplyResult> {
  const { viewer, expert } = await requireExpert();
  const parsed = ReplyInput.safeParse({ code: formData.get("code"), body: formData.get("body") });
  if (!parsed.success) return { ok: false, message: "Wpisz wiadomość (od 2 do 2000 znaków)." };
  try {
    const thread = await needThread({ code: parsed.data.code });
    if (!isAssigned(thread, expert)) return { ok: false, message: "To zgłoszenie nie jest przypisane do Ciebie." };
    if (thread.status === "zamkniete") return { ok: false, message: "Zgłoszenie jest zamknięte — w rozmowie nie można już pisać." };
    await postNeedMessage(thread, { role: "ekspert", name: expert!.name, body: parsed.data.body, actorId: viewer.id });
  } catch (e) {
    console.error("[ekspert] odpowiedź:", e);
    return { ok: false, message: "Nie udało się wysłać. Spróbuj ponownie." };
  }
  refresh();
  return { ok: true, message: "Wysłano. Autor zobaczy Twoją wiadomość od razu, podpisaną Twoim imieniem." };
}
