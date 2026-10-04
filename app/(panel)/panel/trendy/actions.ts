"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { GroqBusyError } from "@/lib/groq";
import { labelNewClusters } from "@/lib/knowledge/clusters";
import { plural } from "@/lib/pl";
import type { ActionResult } from "../actions";

/**
 * Etykiety z LLM dla nowych grup podobnych potrzeb. Wsadowo, na żądanie admina, a nie przy każdym wejściu
 * na stronę: darmowy Groq ma 200 tys. tokenów dziennie na klucz wspólny z aplikacją.
 */
export async function labelClustersAction(): Promise<ActionResult> {
  await requireAdmin("/panel/trendy");
  try {
    const { labeled, remaining } = await labelNewClusters();
    revalidatePath("/panel/trendy");
    if (labeled === 0) return { ok: true, message: "Wszystkie grupy mają już nazwy." };
    const done = `Nazwano ${labeled} ${plural(labeled, "grupę", "grupy", "grup")}.`;
    return { ok: true, message: remaining > 0 ? `${done} Zostało ${remaining}: kliknij jeszcze raz za minutę.` : done };
  } catch (e) {
    console.error("[trendy] etykiety grup:", e);
    if (e instanceof GroqBusyError) return { ok: false, message: "Za dużo zapytań do AI naraz. Spróbuj ponownie za minutę." };
    return { ok: false, message: "Nie udało się nazwać grup. Spróbuj ponownie." };
  }
}
