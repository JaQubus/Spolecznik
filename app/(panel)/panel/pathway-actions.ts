"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { pathwayKeyOrNull, pciProposeContact, pciRecordPartnerAnswer, type ContactOutcome } from "@/lib/contacts";
import { GroqBusyError } from "@/lib/groq";
import { logChange } from "@/lib/panel/initiatives";
import { generatePathwayNarrative } from "@/lib/pathways";
import type { ActionResult } from "./actions";

/** Akcje Panelu dla ścieżek rozwoju i kontaktu z partnerami (6/10). Wynik ogłasza ActionForm (role="status"). */

const MESSAGES: Record<string, string> = {
  czeka_na_tworce: "Propozycja wysłana. Twórca zobaczy ją w rozmowie i zdecyduje.",
  czeka_na_partnera: "Zapisane. Czekamy na zgodę partnera.",
  polaczone: "Obie strony się zgodziły. Wiadomość o kontakcie jest w rozmowie z twórcą.",
  odrzucone: "Zapisane: partner odmówił. Twórca zobaczy to przy partnerze.",
  brak_partnera: "Nie znaleziono aktywnego partnera. Odśwież stronę.",
  partner_odmowil: "Partner już odmówił.",
  brak_prosby: "Nie znaleziono prośby. Odśwież stronę.",
  zamknieta: "Ta prośba jest już zamknięta.",
};
const toResult = (o: ContactOutcome): ActionResult => ({ ok: o.ok, message: MESSAGES[o.ok ? o.state : o.reason] });
const FAILED: ActionResult = { ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." };

const ProposeInput = z.object({
  initiativeId: z.uuid(),
  partnerId: z.uuid(),
  pathway: z.string().optional(),
  partnerAgreed: z.literal("on").optional(),
});

/** Zespół proponuje twórcy kontakt z dopasowanym partnerem (opcjonalnie: partner już się zgodził). */
export async function proposeContact(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = ProposeInput.safeParse({
    initiativeId: formData.get("initiativeId"), partnerId: formData.get("partnerId"),
    pathway: formData.get("pathway") ?? undefined, partnerAgreed: formData.get("partnerAgreed") ?? undefined,
  });
  if (!parsed.success) return FAILED;
  const { initiativeId, partnerId, pathway, partnerAgreed } = parsed.data;
  try {
    const result = toResult(await pciProposeContact(initiativeId, partnerId, pathwayKeyOrNull(pathway), partnerAgreed === "on", user.id));
    refresh();
    return result;
  } catch (e) {
    console.error("[panel] propozycja kontaktu:", e);
    return FAILED;
  }
}

const AnswerInput = z.object({ requestId: z.uuid(), answer: z.enum(["tak", "nie"]) });

/** Zespół zapisuje odpowiedź partnera. Przy zgodzie obu stron otwiera się rozmowa i lejek przechodzi na „w realizacji”. */
export async function recordPartnerAnswer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = AnswerInput.safeParse({ requestId: formData.get("requestId"), answer: formData.get("answer") });
  if (!parsed.success) return FAILED;
  try {
    const result = toResult(await pciRecordPartnerAnswer(parsed.data.requestId, parsed.data.answer === "tak", user.id));
    refresh();
    return result;
  } catch (e) {
    console.error("[panel] odpowiedź partnera:", e);
    return FAILED;
  }
}

const NarrativeInput = z.object({ initiativeId: z.uuid() });

/** „Przygotuj uzasadnienie”: jedno wywołanie modelu dla ścieżek z reguł (lib/pathways). */
export async function regenerateNarrative(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = NarrativeInput.safeParse({ initiativeId: formData.get("initiativeId") });
  if (!parsed.success) return FAILED;
  try {
    const stored = await generatePathwayNarrative(parsed.data.initiativeId);
    await logChange(user.id, "initiative.pathways", "initiative", parsed.data.initiativeId, { keys: stored.keys })
      .catch((e) => console.error("[panel] historia:", e));
  } catch (e) {
    if (e instanceof GroqBusyError) return { ok: false, message: "AI jest teraz zajęte. Spróbuj ponownie za minutę." };
    console.error("[panel] uzasadnienie ścieżek:", e);
    return { ok: false, message: "Nie udało się przygotować uzasadnienia. Spróbuj ponownie." };
  }
  refresh();
  return { ok: true, message: "Uzasadnienie i kolejne kroki są gotowe." };
}
