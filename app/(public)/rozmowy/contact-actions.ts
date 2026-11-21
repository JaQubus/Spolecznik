"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { authorDeclineContact, authorRequestContact, pathwayKeyOrNull, type ContactOutcome } from "@/lib/contacts";
import { STATUS_CODE } from "@/lib/schemas";
import { authorizedThread } from "@/lib/threads";
import { org } from "@/lib/brand";

/** Wynik akcji kontaktu ogłaszany przez role="status" w components/pathways/contact-button.tsx. */
export type ContactActionResult = { ok: boolean; message: string } | null;

const NO_KEY: ContactActionResult = {
  ok: false,
  message: "Prośbę wyślesz z urządzenia, z którego wysłano zgłoszenie, albo po otwarciu prywatnego linku.",
};
const FAILED: ContactActionResult = { ok: false, message: "Nie udało się zapisać. Spróbuj ponownie za chwilę." };

const MESSAGES: Record<string, string> = {
  czeka_na_partnera: `Prośba wysłana. Zespół ${org.short} zapyta partnera o zgodę. Przedstawimy was sobie w rozmowie dopiero, gdy się zgodzi.`,
  czeka_na_tworce: "Zapisane.",
  polaczone: `Obie strony się zgodziły. Zespół ${org.short} przedstawi was sobie w rozmowie.`,
  odrzucone: "Zapisane. Partner nie dostanie prośby.",
  partner_odmowil: "Ten partner nie może teraz współpracować. Zapytaj zespół w rozmowie o innych.",
  brak_partnera: "Nie znaleźliśmy tego partnera. Odśwież stronę.",
  brak_prosby: "Nie znaleźliśmy tej prośby. Odśwież stronę.",
  zamknieta: "Ta prośba jest już zamknięta. Odśwież stronę.",
};

const toResult = (o: ContactOutcome): ContactActionResult => ({ ok: o.ok, message: MESSAGES[o.ok ? o.state : o.reason] });

const RequestInput = z.object({ code: z.string().trim().toUpperCase().regex(STATUS_CODE), partnerId: z.uuid(), pathway: z.string().optional() });

/** „Poproś o kontakt” albo „Zgadzam się” na propozycję zespołu. Tylko przeglądarka z kluczem do zgłoszenia. */
export async function requestContact(_prev: ContactActionResult, formData: FormData): Promise<ContactActionResult> {
  const parsed = RequestInput.safeParse({ code: formData.get("code"), partnerId: formData.get("partnerId"), pathway: formData.get("pathway") ?? undefined });
  if (!parsed.success) return FAILED;
  try {
    const thread = await authorizedThread(parsed.data.code);
    if (!thread) return NO_KEY;
    const result = toResult(await authorRequestContact({ id: thread.id, code: thread.code }, parsed.data.partnerId, pathwayKeyOrNull(parsed.data.pathway)));
    refresh();
    return result;
  } catch (e) {
    console.error("[kontakt] prośba:", e);
    return FAILED;
  }
}

const DeclineInput = z.object({ code: z.string().trim().toUpperCase().regex(STATUS_CODE), requestId: z.uuid() });

/** Odmowa propozycji zespołu albo wycofanie własnej prośby. */
export async function declineContact(_prev: ContactActionResult, formData: FormData): Promise<ContactActionResult> {
  const parsed = DeclineInput.safeParse({ code: formData.get("code"), requestId: formData.get("requestId") });
  if (!parsed.success) return FAILED;
  try {
    const thread = await authorizedThread(parsed.data.code);
    if (!thread) return NO_KEY;
    const result = toResult(await authorDeclineContact(thread.id, parsed.data.requestId));
    refresh();
    return result;
  } catch (e) {
    console.error("[kontakt] odmowa:", e);
    return FAILED;
  }
}
