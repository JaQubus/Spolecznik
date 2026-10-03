import "server-only";
import gminyJson from "@/data/out/gminy.json";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

/** Podpowiedź w polu „Gmina”: nazwa do wpisania i opis, który rozróżnia np. Bochnię miejską i wiejską. */
export type GminaOption = { teryt: string; nazwa: string; opis: string };

/**
 * Wszystkie gminy Małopolski (BDL, data/bdl.py), alfabetycznie. Zgodne z listą
 * malopolska.uw.gov.pl/dane_teleadresowe/adresyGmin plus miasta na prawach powiatu.
 * Strony przekazują ją do pola jako props, żeby do przeglądarki nie trafił cały gminy.json.
 */
export const GMINA_OPTIONS: GminaOption[] = gminyJson
  .map((g) => ({
    teryt: g.teryt,
    nazwa: g.nazwa,
    opis: g.powiat.startsWith("m. ")
      ? "miasto na prawach powiatu"
      : `gmina ${g.typ}, powiat ${g.powiat}`,
  }))
  .sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl") || a.opis.localeCompare(b.opis, "pl"));

export type Gmina = {
  teryt: string;
  nazwa: string;
  powiat: string;
  typ: string | null;
  ludnosc: number | null;
  udzial_65plus: number | null; // w procentach, np. 24.1
  zmiana_ludnosci_10l: number | null; // w procentach, np. -5.3
  wskazniki: Record<string, unknown>;
};

function normalize(name: string): string {
  return name
    .trim()
    .replace(/^(gmina|gm\.|miasto|m\.)\s+/i, "")
    .replace(/[%_\\]/g, ""); // znaki specjalne ILIKE
}

/**
 * Gmina po TERYT (wybrana z podpowiedzi), a bez niego po nazwie (bez rozróżniania wielkości liter).
 * Przy dwóch gminach o tej samej nazwie i bez TERYT bierze większą.
 */
export async function findGmina(name: string | null | undefined, teryt?: string): Promise<Gmina | null> {
  if (teryt) {
    const { data, error } = await createAdminClient().from("gminy").select("*").eq("teryt", teryt).maybeSingle();
    if (error) throw error;
    if (data) return data as Gmina;
  }
  if (!name) return null;
  const q = normalize(name);
  if (!q) return null;
  const { data, error } = await createAdminClient()
    .from("gminy")
    .select("*")
    .ilike("nazwa", q)
    .order("ludnosc", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Gmina) ?? null;
}

const pct = (n: number) => `${n.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`;

/** Profil gminy prostym tekstem — kontekst dla reranku („co dostosować u Ciebie”). */
export function describeGmina(g: Gmina): string {
  const parts = [`Gmina ${g.nazwa}${g.typ ? ` (${g.typ})` : ""}, powiat ${g.powiat}.`];
  if (g.ludnosc != null) parts.push(`Ludność: ${g.ludnosc.toLocaleString("pl-PL")}.`);
  if (g.udzial_65plus != null) parts.push(`Osoby 65+: ${pct(g.udzial_65plus)}.`);
  if (g.zmiana_ludnosci_10l != null) parts.push(`Zmiana liczby ludności w 10 lat: ${pct(g.zmiana_ludnosci_10l)}.`);
  if (g.wskazniki && Object.keys(g.wskazniki).length > 0) parts.push(`Inne wskaźniki: ${JSON.stringify(g.wskazniki)}.`);
  return parts.join(" ");
}

/** „Bochnia (gmina wiejska, powiat bocheński)”, „Kraków (miasto na prawach powiatu)”. */
export function gminaLabel(g: Pick<Gmina, "nazwa" | "powiat" | "typ">): string {
  if (g.powiat.startsWith("m. ")) return `${g.nazwa} (miasto na prawach powiatu)`;
  return `${g.nazwa} (gmina ${g.typ ?? ""}, powiat ${g.powiat})`.replace("gmina ,", "gmina,");
}

/** Wszystkie gminy z tabeli gminy (publiczny odczyt) do mapy gmin w Kondycji Małopolski. */
export async function listGminy(): Promise<Gmina[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gminy")
    .select("teryt, nazwa, powiat, typ, ludnosc, udzial_65plus, zmiana_ludnosci_10l, wskazniki")
    .order("teryt");
  if (error) throw error;
  return (data ?? []).map((g) => ({
    ...g,
    udzial_65plus: g.udzial_65plus == null ? null : Number(g.udzial_65plus),
    zmiana_ludnosci_10l: g.zmiana_ludnosci_10l == null ? null : Number(g.zmiana_ludnosci_10l),
  })) as Gmina[];
}
