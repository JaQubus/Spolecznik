import { GROUPS } from "@/lib/schemas";

/** Pierwsza wartość parametru z adresu (?dla=…&q=…), przycięta. */
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export const isGroup = (v: string): v is (typeof GROUPS)[number] => (GROUPS as readonly string[]).includes(v);

/** Link w treści: pogrubiony i podkreślony (kolor nie jest jedynym wyróżnikiem). */
export const LINK = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";
/** Link z ikoną przed tekstem. */
export const ICON_LINK = `inline-flex items-center gap-2 ${LINK}`;

/** Next oddaje params już zdekodowane; dekodujemy ostrożnie, żeby „%” w adresie dał 404, a nie błąd. */
export function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}
