import "server-only";
import { KONDYCJA_KEYS } from "./kondycja";
import { createClient } from "./supabase/server";

export type Powiat = { id: string; nazwa: string };
export type Value = { value: number | null; unit: string };

export type PowiatyData = {
  year: number | null;
  powiaty: Powiat[];
  /** values[wskaźnik][powiat] */
  values: Record<string, Record<string, Value>>;
};

/** „powiat m. Kraków” → „Kraków”, „powiat bocheński” → „bocheński”. */
export function shortName(nazwa: string): string {
  return nazwa.replace(/^powiat\s+/, "").replace(/^m\.\s*/, "");
}

/** „Kraków (miasto na prawach powiatu)”, „powiat bocheński”. */
export function longName(nazwa: string): string {
  return /^powiat\s+m\./.test(nazwa) ? `${shortName(nazwa)} (miasto na prawach powiatu)` : nazwa;
}

/** Wskaźniki Kondycji Małopolski z najnowszego roku w tabeli powiaty_wskazniki. */
export async function getKondycjaData(): Promise<PowiatyData> {
  const supabase = await createClient();
  const { data: latest, error: yearError } = await supabase
    .from("powiaty_wskazniki")
    .select("rok")
    .order("rok", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (yearError) throw yearError;
  if (!latest) return { year: null, powiaty: [], values: {} };

  const { data, error } = await supabase
    .from("powiaty_wskazniki")
    .select("powiat, nazwa, wskaznik, wartosc, jednostka")
    .eq("rok", latest.rok)
    .in("wskaznik", KONDYCJA_KEYS);
  if (error) throw error;

  const names = new Map<string, string>();
  const values: PowiatyData["values"] = {};
  for (const r of data) {
    names.set(r.powiat, r.nazwa);
    (values[r.wskaznik] ??= {})[r.powiat] = { value: r.wartosc == null ? null : Number(r.wartosc), unit: r.jednostka };
  }
  const powiaty = [...names].map(([id, nazwa]) => ({ id, nazwa }))
    .sort((a, b) => shortName(a.nazwa).localeCompare(shortName(b.nazwa), "pl"));
  return { year: latest.rok, powiaty, values };
}
