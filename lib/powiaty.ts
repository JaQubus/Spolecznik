import "server-only";
import { createClient } from "./supabase/server";

export type PowiatIndicator = {
  wskaznik: string;
  kategoria: string;
  opis: string | null;
  jednostka: string;
  rok: number;
};

export type PowiatValue = PowiatIndicator & {
  powiat: string;
  nazwa: string;
  wartosc: number | null;
};

export async function listPowiatyIndicators(): Promise<PowiatIndicator[]> {
  const supabase = await createClient();
  // Supabase oddaje najwyżej max_rows wierszy (domyślnie 1000), a tabela ma ich ~2500 (22 powiaty × 112
  // wskaźników × lata). Bez stronicowania połowa wskaźników po cichu znikała. Czytamy do pustej strony,
  // więc działa przy każdym max_rows; kolejność jest pełna, żeby strony się nie nakładały.
  const rows: PowiatIndicator[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await supabase
      .from("powiaty_wskazniki")
      .select("wskaznik, kategoria, opis, jednostka, rok")
      .order("kategoria")
      .order("wskaznik")
      .order("powiat")
      .order("rok")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as PowiatIndicator[]));
    from += data.length;
  }
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.kategoria}|${row.wskaznik}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function listPowiatyValues(indicator: string): Promise<PowiatValue[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("powiaty_wskazniki")
    .select("powiat, nazwa, kategoria, wskaznik, opis, rok, wartosc, jednostka")
    .eq("wskaznik", indicator)
    .order("nazwa");
  if (error) throw error;
  const latest = new Map<string, PowiatValue>();
  for (const row of data ?? []) {
    const current = latest.get(row.powiat);
    if (!current || row.rok > current.rok) latest.set(row.powiat, row as PowiatValue);
  }
  return [...latest.values()];
}
