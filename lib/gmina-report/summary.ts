// Raport gminy (#104): podsumowanie z szablonu i sprawdzanie podsumowania z modelu.
// Model pisze tylko zdania z gotowych liczb; każda liczba w jego tekście musi wystąpić w danych wejściowych.
import type { AreaKey } from "../knowledge/types.ts";
import { AREA_LABELS } from "../taxonomy.ts";
import type { GminaProfile, IndicatorRow } from "./score.ts";

export function formatNumber(v: number, decimals = 0): string {
  return v.toLocaleString("pl-PL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** „22,5%”, „242 na 10 tys. mieszkańców”. */
export function withUnit(v: number, unit: string, decimals: number): string {
  const n = formatNumber(v, decimals);
  if (unit === "%") return `${n}%`;
  return unit.startsWith("%") ? `${n}${unit}` : `${n} ${unit}`;
}

/** Główny wskaźnik obszaru: pierwszy z wartością (kolejność jak w config.ts). */
export const leadIndicator = (p: GminaProfile, area: AreaKey): IndicatorRow | null =>
  p.areas.find((a) => a.area === area)?.indicators.find((i) => i.value != null) ?? null;

const TYPE_WORDS = { miejska: "gmina miejska", wiejska: "gmina wiejska", "miejsko-wiejska": "gmina miejsko-wiejska" } as const;

function listPl(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} i ${items[items.length - 1]}`;
}

/** Zapasowe podsumowanie bez modelu — zawsze poprawne, bo składa się wyłącznie z liczb raportu. */
export function templateSummary(p: GminaProfile): string {
  const who = [
    `${p.name} to ${p.type ? TYPE_WORDS[p.type] : "gmina"}`,
    p.population != null ? `, w której mieszka ${formatNumber(p.population)} osób` : "",
    ".",
  ].join("");
  const cohort = `Porównujemy ją z ${p.cohort.members.length - 1} gminami podobnymi (${p.cohort.label}).`;
  if (!p.focus.length) {
    return `${who} ${cohort} W żadnym z ośmiu obszarów Mapy Wyzwań potrzeby nie są tu wyraźnie większe niż w gminach podobnych.`;
  }
  const areas = `Obszary do uwagi: ${listPl(p.focus.map((a) => AREA_LABELS[a].toLowerCase()))}.`;
  const lead = leadIndicator(p, p.focus[0]);
  let detail = "";
  if (lead?.value != null) {
    const typical = lead.cohortMedian ?? lead.regionMedian;
    const where = lead.cohortMedian != null ? "w gminach podobnych" : "w powiatach Małopolski";
    detail = typical != null
      ? ` ${lead.label}: ${withUnit(lead.value, lead.unit, lead.decimals)}${lead.level === "powiat" ? " w powiecie" : ""}, a typowo ${where} ${withUnit(typical, lead.unit, lead.decimals)}.`
      : "";
  }
  return `${who} ${cohort} ${areas}${detail}`;
}

/** Liczby, które model może przytoczyć: wszystko, co dostał w danych wejściowych (wartości bez znaku). */
export function allowedNumbers(p: GminaProfile): number[] {
  const out = [p.population, p.change10y, p.share65, p.cohort.members.length, p.cohort.members.length - 1, p.focus.length];
  for (const a of p.areas) {
    out.push(a.score);
    for (const i of a.indicators) {
      out.push(i.value, i.cohortMedian, i.regionMedian, i.lowerPct, i.higherPct, i.comparedWith, i.source.year);
      out.push(...numbersIn(`${i.label} ${i.unit}`).map((n) => n.value)); // „Osoby w wieku 65+”, „na 10 tys.”
    }
  }
  // Progi z nazwy grupy („do 15 tys. mieszkańców”).
  out.push(...numbersIn(p.cohort.label).map((n) => n.value));
  return out.filter((v): v is number => v != null).map(Math.abs);
}

// Liczba z grupowaniem tysięcy („28 187”, także twarda spacja) albo zwykła, z przecinkiem lub kropką dziesiętną.
const NUMBER = /(?<![\d,.])(?:\d{1,3}(?:[   ]\d{3})+|\d+)(?:[.,]\d+)?(?![\d])/g;

/** Liczby z tekstu (bez znaku): „22,5%” → 22.5, „28 187” → 28187. */
export function numbersIn(text: string): { value: number; decimals: number }[] {
  return [...text.matchAll(NUMBER)].map((m) => {
    const raw = m[0].replace(/[   ]/g, "").replace(",", ".");
    const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
    return { value: Number(raw), decimals };
  });
}

/** Słowa, które oceniają gminę zamiast opisywać potrzeby. Raport mówi „obszar do uwagi”. */
const JUDGING = /problemow|gorsz|najgorsz|zacofan|patologi|słab(a|e|sz)/i;
/** Raport podaje mediany i odsetki — „średnia” w tekście modelu to prawie zawsze źle odczytane porównanie. */
const MISREAD = /średni|przeciętn/i;

/**
 * Czy podsumowanie z modelu można pokazać: każda liczba musi być zaokrągleniem którejś liczby z danych
 * (z tą samą liczbą miejsc po przecinku), bez słów oceniających i w rozsądnej długości.
 */
export function checkSummary(text: string, allowed: number[]): { ok: boolean; reason: string | null } {
  const t = text.trim();
  if (t.length < 40 || t.length > 700) return { ok: false, reason: "długość" };
  return checkSentence(t, allowed);
}

/** To samo bez warunku długości — dla pojedynczych zdań (np. „co uwzględnić u Was” z reranku). */
export function checkSentence(text: string, allowed: number[]): { ok: boolean; reason: string | null } {
  if (JUDGING.test(text)) return { ok: false, reason: "słowa oceniające" };
  if (MISREAD.test(text)) return { ok: false, reason: "„średnia” zamiast porównania z danych" };
  for (const n of numbersIn(text)) {
    const f = 10 ** n.decimals;
    if (!allowed.some((a) => Math.round(a * f) / f === n.value)) return { ok: false, reason: `liczba spoza danych: ${n.value}` };
  }
  return { ok: true, reason: null };
}

const attr = (s: string) => s.replace(/"/g, "'");

/** Jak wartość gminy wypada na tle porównania: „wyższa niż w 85% gmin podobnych”. */
export function comparisonText(i: IndicatorRow): string | null {
  if (i.lowerPct == null || i.higherPct == null) return null;
  const whom = i.level === "gmina" ? "gmin podobnych" : "powiatów Małopolski";
  // Przy remisach (np. tyle samo przychodni co w połowie gmin) ani „wyższa”, ani „niższa” nie byłoby prawdą.
  if (i.lowerPct >= 50) return `wyższa niż w ${i.lowerPct}% ${whom}`;
  if (i.higherPct >= 50) return `niższa niż w ${i.higherPct}% ${whom}`;
  return `podobna jak w większości ${whom}`;
}

/** Dane dla modelu piszącego podsumowanie: tylko liczby z raportu, już sformatowane po polsku. */
export function summaryFacts(p: GminaProfile): string {
  const head = [
    `nazwa="${attr(p.name)}"`,
    p.type && `typ="${TYPE_WORDS[p.type]}"`,
    p.population != null && `mieszkancy="${formatNumber(p.population)}"`,
    p.change10y != null && `zmiana_liczby_mieszkancow_w_10_lat="${formatNumber(p.change10y, 1)}%"`,
    p.share65 != null && `udzial_osob_65_plus="${formatNumber(p.share65, 1)}%"`,
  ].filter(Boolean).join(" ");
  const areas = p.focus.map((area) => {
    const a = p.areas.find((x) => x.area === area)!;
    const rows = a.indicators.filter((i) => i.value != null).map((i) => {
      const typical = i.level === "gmina"
        ? i.cohortMedian != null && `typowo w gminach podobnych ${withUnit(i.cohortMedian, i.unit, i.decimals)}`
        : i.regionMedian != null && `typowo w powiatach Małopolski ${withUnit(i.regionMedian, i.unit, i.decimals)}`;
      return [`${i.label}: ${withUnit(i.value!, i.unit, i.decimals)}`, typical, comparisonText(i)].filter(Boolean).join("; ");
    });
    return `<obszar_do_uwagi nazwa="${AREA_LABELS[area]}" poziom="${a.level}">${rows.join(" | ")}</obszar_do_uwagi>`;
  });
  return [
    `<gmina ${head}>`,
    `<grupa_porownawcza nazwa="${attr(p.cohort.label)}" liczba_gmin="${p.cohort.members.length}"/>`,
    ...(areas.length ? areas : ["<obszary_do_uwagi>brak — potrzeby typowe dla gmin podobnych</obszary_do_uwagi>"]),
    "</gmina>",
  ].join("\n");
}

/**
 * Profil grupy porównawczej dla reranku (pole <gmina> w lib/llm.ts → rerank): rerank liczymy raz na obszar
 * i grupę, więc mówi o typowej gminie z grupy, nie o jednej gminie.
 */
export function cohortProfile(p: GminaProfile, area: AreaKey): string {
  const a = p.areas.find((x) => x.area === area);
  const typical = (a?.indicators ?? []).map((i) => {
    const v = i.level === "gmina" ? i.cohortMedian : i.regionMedian;
    return v != null ? `${i.label}${i.level === "powiat" ? " (dane powiatów)" : ""}: typowo ${withUnit(v, i.unit, i.decimals)}` : null;
  }).filter(Boolean);
  return [
    `Typowa gmina z grupy: ${p.cohort.label} (${p.cohort.members.length} gmin w Małopolsce).`,
    typical.length ? `Obszar ${AREA_LABELS[area].toLowerCase()}: ${typical.join("; ")}.` : "",
  ].join(" ").trim();
}
