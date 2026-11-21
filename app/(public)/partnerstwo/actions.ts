"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { respondToInvitation, startPartnership } from "@/lib/partnerships";
import { STATUS_CODE } from "@/lib/schemas";
import { canOpen, initiativeThread } from "@/lib/threads";

/** Tylko przeglądarka z kluczem do zgłoszenia może zapraszać i odpowiadać w jego imieniu (lib/initiatives/access.ts). */
async function ownInitiative(code: string) {
  const initiative = await initiativeThread({ code });
  return initiative && (await canOpen(initiative)) ? initiative : null;
}

const base = (code: string) => `/partnerstwo?kod=${code}`;

const StartInput = z.object({ code: z.string().regex(STATUS_CODE) });

export async function invite(formData: FormData) {
  const parsed = StartInput.safeParse({ code: formData.get("code") });
  if (!parsed.success) redirect("/rozmowy");
  const { code } = parsed.data;
  if (!(await ownInitiative(code))) redirect(`/rozmowy?kod=${code}`);
  const started = await startPartnership(code);
  if (!started) redirect(base(code));
  redirect(`${base(code)}&watek=${started.threadId}&wyslano=${started.invited}`);
}

const RespondInput = z.object({ code: z.string().regex(STATUS_CODE), threadId: z.uuid(), answer: z.enum(["tak", "nie"]) });

export async function respond(formData: FormData) {
  const parsed = RespondInput.safeParse({ code: formData.get("code"), threadId: formData.get("threadId"), answer: formData.get("answer") });
  if (!parsed.success) redirect("/rozmowy");
  const { code, threadId, answer } = parsed.data;
  const initiative = await ownInitiative(code);
  if (!initiative) redirect(`/rozmowy?kod=${code}`);
  await respondToInvitation(initiative.id, threadId, answer === "tak");
  redirect(answer === "tak" ? `${base(code)}&watek=${threadId}&dolaczono=1` : `${base(code)}&odrzucono=1`);
}
