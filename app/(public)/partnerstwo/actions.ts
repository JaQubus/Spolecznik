"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { respondToInvitation, startPartnership } from "@/lib/partnerships";
import { STATUS_CODE } from "@/lib/schemas";
import { canOpen, needThread } from "@/lib/threads";

/** Tylko przeglądarka z kluczem do zgłoszenia może zapraszać i odpowiadać w jego imieniu (lib/need-access.ts). */
async function ownNeed(code: string) {
  const need = await needThread({ code });
  return need?.kind === "potrzeba" && (await canOpen(need)) ? need : null;
}

const base = (code: string) => `/partnerstwo?potrzeba=${code}`;

const StartInput = z.object({ code: z.string().regex(STATUS_CODE) });

export async function invite(formData: FormData) {
  const parsed = StartInput.safeParse({ code: formData.get("code") });
  if (!parsed.success) redirect("/zapytaj");
  const { code } = parsed.data;
  if (!(await ownNeed(code))) redirect(`/zapytaj?kod=${code}`);
  const started = await startPartnership(code);
  if (!started) redirect(base(code));
  redirect(`${base(code)}&watek=${started.threadId}&wyslano=${started.invited}`);
}

const RespondInput = z.object({ code: z.string().regex(STATUS_CODE), threadId: z.uuid(), answer: z.enum(["tak", "nie"]) });

export async function respond(formData: FormData) {
  const parsed = RespondInput.safeParse({ code: formData.get("code"), threadId: formData.get("threadId"), answer: formData.get("answer") });
  if (!parsed.success) redirect("/zapytaj");
  const { code, threadId, answer } = parsed.data;
  const need = await ownNeed(code);
  if (!need) redirect(`/zapytaj?kod=${code}`);
  await respondToInvitation(need.id, threadId, answer === "tak");
  redirect(answer === "tak" ? `${base(code)}&watek=${threadId}&dolaczono=1` : `${base(code)}&odrzucono=1`);
}
