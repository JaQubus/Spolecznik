"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isAssigned, requireMentor } from "@/lib/mentors";
import { STATUS_CODE } from "@/lib/schemas";
import { initiativeThread, postStaffMessage } from "@/lib/threads";

export type ReplyResult = { ok: boolean; message: string } | null;

const ReplyInput = z.object({ code: z.string().regex(STATUS_CODE), body: z.string().trim().min(2).max(2000) });

/** Odpowiedź mentora w rozmowie — tylko przy inicjatywie przypisanej do niego. */
export async function replyAsMentor(_prev: ReplyResult, formData: FormData): Promise<ReplyResult> {
  const { viewer, mentor } = await requireMentor();
  const parsed = ReplyInput.safeParse({ code: formData.get("code"), body: formData.get("body") });
  if (!parsed.success) return { ok: false, message: "Wpisz wiadomość (od 2 do 2000 znaków)." };
  try {
    const thread = await initiativeThread({ code: parsed.data.code });
    if (!isAssigned(thread, mentor)) return { ok: false, message: "Ta inicjatywa nie jest przypisana do Ciebie." };
    if (thread.status === "archived") return { ok: false, message: "Zgłoszenie jest zamknięte — w rozmowie nie można już pisać." };
    await postStaffMessage(thread, { role: "mentor", name: mentor!.name, body: parsed.data.body, actorId: viewer.id });
  } catch (e) {
    console.error("[mentor] odpowiedź:", e);
    return { ok: false, message: "Nie udało się wysłać. Spróbuj ponownie." };
  }
  refresh();
  return { ok: true, message: "Wysłano. Autor zobaczy Twoją wiadomość od razu, podpisaną Twoim imieniem." };
}
