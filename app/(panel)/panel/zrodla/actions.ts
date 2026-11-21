"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { logChange } from "@/lib/panel/initiatives";
import { plural } from "@/lib/pl";
import { ClaimError, issueClaimKey, scanPending } from "@/lib/sources";
import type { ActionResult } from "../actions";

/** „Skanuj źródła”: jedna porcja klasyfikacji rekordów bez oceny (limit Groq jest mały, więc po kilka naraz). */
export async function scanSources(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await scanPending(3);
    refresh();
    if (r.classified === 0 && r.busy) return { ok: false, message: "AI jest teraz zajęta. Spróbuj ponownie za minutę." };
    if (r.classified === 0) return { ok: true, message: "Wszystkie rekordy są już ocenione." };
    const found = r.candidates - r.duplicates;
    return {
      ok: true,
      message: `Oceniono ${r.classified} ${plural(r.classified, "rekord", "rekordy", "rekordów")}. Nowe kandydatki: ${found}` +
        (r.duplicates ? `, duplikaty już wykrytych: ${r.duplicates}` : "") +
        `. Zostało do oceny: ${r.left}${r.busy ? " (AI przerwała, dokończ za minutę)" : ""}.`,
    };
  } catch (e) {
    console.error("[panel] skanowanie źródeł:", e);
    return { ok: false, message: "Nie udało się ocenić rekordów. Sprawdź, czy baza ma migrację 0008." };
  }
}

const ClaimLinkInput = z.object({ initiativeId: z.uuid() });

/**
 * Link do przejęcia wykrytej inicjatywy: zespół wysyła go twórcy albo instytucji (np. do biura transferu technologii).
 * Klucz pokazujemy tylko raz — w bazie jest jego skrót. Nowy link unieważnia poprzedni.
 */
export async function issueClaimLink(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = ClaimLinkInput.safeParse({ initiativeId: formData.get("initiativeId") });
  if (!parsed.success) return { ok: false, message: "Nie znaleziono inicjatywy. Odśwież stronę." };
  try {
    const { code, key } = await issueClaimKey(parsed.data.initiativeId);
    await logChange(user.id, "initiative.claim_link", "initiative", parsed.data.initiativeId, { code });
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    return { ok: true, message: `Link do przejęcia (zapisz go teraz, drugi raz go nie pokażemy): ${origin}/przejmij/${code}/${key}` };
  } catch (e) {
    if (e instanceof ClaimError) return { ok: false, message: e.message };
    console.error("[panel] link do przejęcia:", e);
    return { ok: false, message: "Nie udało się utworzyć linku. Spróbuj ponownie." };
  }
}
