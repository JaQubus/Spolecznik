import "server-only";
import gminyJson from "@/data/out/gminy.json";
import wskaznikiJson from "@/data/out/gminy_wskazniki.json";
import type { GminaFact } from "./schemas";
import { createAdminClient } from "./supabase/admin";

/** Podpowiedź w polu „Gmina”: nazwa do wpisania i opis, który rozróżnia gminę miejską i wiejską o tej samej nazwie. */
export type GminaOption = { teryt: string; nazwa: string; opis: string };

/**
 * Wszystkie gminy regionu z config/brand.json (BDL, data/bdl.py), alfabetycznie, razem z miastami na prawach powiatu.
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

type MunicipalityRow = {
  teryt: string; name: string; county: string; kind: string | null; population: number | null;
  share_65plus: number | string | null; population_change_10y: number | string | null; indicators: Record<string, unknown> | null;
};
const COLUMNS = "teryt, name, county, kind, population, share_65plus, population_change_10y, indicators";
const num = (v: number | string | null) => (v == null ? null : Number(v));

/** Wiersz tabeli municipalities → profil gminy (te same pola co data/out/gminy.json). */
function fromRow(r: MunicipalityRow): Gmina {
  return {
    teryt: r.teryt, nazwa: r.name, powiat: r.county, typ: r.kind, ludnosc: r.population,
    udzial_65plus: num(r.share_65plus), zmiana_ludnosci_10l: num(r.population_change_10y), wskazniki: r.indicators ?? {},
  };
}

/**
 * Gmina po TERYT (wybrana z podpowiedzi), a bez niego po nazwie (bez rozróżniania wielkości liter).
 * Przy dwóch gminach o tej samej nazwie i bez TERYT bierze większą.
 */
export async function findGmina(name: string | null | undefined, teryt?: string): Promise<Gmina | null> {
  if (teryt) {
    const { data, error } = await createAdminClient().from("municipalities").select(COLUMNS).eq("teryt", teryt).maybeSingle();
    if (error) throw error;
    if (data) return fromRow(data as MunicipalityRow);
  }
  if (!name) return null;
  const q = normalize(name);
  if (!q) return null;
  const { data, error } = await createAdminClient()
    .from("municipalities")
    .select(COLUMNS)
    .ilike("name", q)
    .order("population", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ? fromRow(data[0] as MunicipalityRow) : null;
}

const pct = (n: number) => `${n.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`;

/** Profil gminy prostym tekstem — kontekst dla reranku i radaru („co dostosować u Ciebie”). */
export function describeGmina(g: Gmina): string {
  const parts = [`Gmina ${g.nazwa}${g.typ ? ` (${g.typ})` : ""}, powiat ${g.powiat}.`];
  if (g.ludnosc != null) parts.push(`Ludność: ${g.ludnosc.toLocaleString("pl-PL")}.`);
  if (g.udzial_65plus != null) parts.push(`Osoby 65+: ${pct(g.udzial_65plus)}.`);
  if (g.zmiana_ludnosci_10l != null) parts.push(`Zmiana liczby ludności w 10 lat: ${pct(g.zmiana_ludnosci_10l)}.`);
  if (g.wskazniki && Object.keys(g.wskazniki).length > 0) parts.push(`Inne wskaźniki: ${JSON.stringify(g.wskazniki)}.`);
  return parts.join(" ");
}

type Indicator = { key: string; label: string; unit: string; bdl: string; year: number };
const INDICATORS = wskaznikiJson.indicators as Indicator[];
const INDICATOR_VALUES = wskaznikiJson.values as Record<string, Record<string, number | null>>;
/** Wskaźniki „na N mieszkańców” przeliczane na liczbę osób w gminie, bo tej liczby potrzebuje plan przeniesienia. */
const PER_RESIDENTS: Record<string, { label: string; per: number }> = {
  beneficjenci: { label: "Osoby korzystające z pomocy społecznej", per: 10_000 },
  urodzenia: { label: "Urodzenia w roku", per: 1000 },
};

/**
 * Profil gminy jako lista liczb ze źródłem (BDL GUS: data/bdl.py i data/bdl_wskazniki.py).
 * Plan przeniesienia (/api/transfer) pokazuje tylko te liczby, więc każda ma podany wskaźnik i rok.
 * Wartości „wyliczone” to iloczyn dwóch liczb z BDL i są tak podpisane.
 */
export function gminaFacts(g: Gmina): GminaFact[] {
  const year = typeof g.wskazniki?.rok === "number" ? g.wskazniki.rok : null;
  const bdl = year ? `BDL GUS, ${year}` : "BDL GUS";
  const facts: GminaFact[] = [];
  if (g.ludnosc != null) facts.push({ id: "ludnosc", label: "Liczba mieszkańców", value: g.ludnosc, unit: "osób", source: bdl });
  if (g.udzial_65plus != null) {
    facts.push({ id: "udzial_65plus", label: "Udział osób w wieku 65+", value: g.udzial_65plus, unit: "%", source: bdl });
    if (g.ludnosc != null) facts.push({
      id: "osoby_65plus", label: "Osoby w wieku 65+", value: Math.round((g.ludnosc * g.udzial_65plus) / 100), unit: "osób",
      source: `wyliczone: liczba mieszkańców × udział 65+ (${bdl})`,
    });
  }
  if (g.zmiana_ludnosci_10l != null) facts.push({
    id: "zmiana_ludnosci_10l", label: "Zmiana liczby mieszkańców w 10 lat", value: g.zmiana_ludnosci_10l, unit: "%", source: bdl,
  });

  const values = INDICATOR_VALUES[g.teryt] ?? {};
  for (const i of INDICATORS) {
    const value = values[i.key];
    if (value == null) continue;
    const source = `BDL GUS, wskaźnik ${i.bdl}, ${i.year}`;
    facts.push({ id: i.key, label: i.label, value, unit: i.unit, source });
    const derived = PER_RESIDENTS[i.key];
    if (derived && g.ludnosc != null) facts.push({
      id: `${i.key}_liczba`,
      label: derived.label,
      value: Math.round((value * g.ludnosc) / derived.per),
      unit: "osób",
      source: `wyliczone: wskaźnik ${i.unit} × liczba mieszkańców (${source}; ${bdl})`,
    });
  }
  return facts;
}

/** „Czarna (gmina wiejska, powiat bieszczadzki)”, „Rzeszów (miasto na prawach powiatu)”. */
export function gminaLabel(g: Pick<Gmina, "nazwa" | "powiat" | "typ">): string {
  if (g.powiat.startsWith("m. ")) return `${g.nazwa} (miasto na prawach powiatu)`;
  return `${g.nazwa} (gmina ${g.typ ?? ""}, powiat ${g.powiat})`.replace("gmina ,", "gmina,");
}
