/**
 * Kondycja Małopolski: tematy dla 183 gmin (tabela gminy, dane BDL z data/bdl.py) i zamiana liczb
 * na zdania prostym językiem. Zdania są liczone z danych deterministycznie — bez LLM — więc zawsze
 * zgadzają się z tabelą obok.
 */
import { formatNumber } from "./pl";
import type { CROSS, GROUPS, MWS_AREAS } from "./schemas";

type Area = (typeof MWS_AREAS)[number];
type Group = (typeof GROUPS)[number];
type Cross = (typeof CROSS)[number];

/** Która strona skali oznacza większe wyzwanie — od tego zależy kolor na mapie i „wyzwanie” w karcie. */
export type Worse = "higher" | "lower";

/** Temat nazywamy „wyzwaniem” gminy dopiero wtedy, gdy gmina wypada w nim gorzej niż połowa gmin. */
export const CHALLENGE_MIN = 0.5;

export type GminaField = "udzial_65plus" | "zmiana_ludnosci_10l";

export type GminaTopic = {
  key: string;
  label: string;
  intro: string;
  /** Nagłówek kolumny w tabeli. */
  column: string;
  field: GminaField;
  worse: Worse;
  format: (v: number) => string;
  sentence: (v: number) => string;
  /** Porównanie z medianą gmin; d jak w regionDirection. */
  compare: (d: -1 | 0 | 1, v: number) => string;
  /** Jakie innowacje podsunąć gminie, w której temat wypada źle. */
  innovations: { area?: Area; groups: Group[]; cross: Cross[] };
};

const perHundred = (x: number) => (x < 1 ? "mniej niż 1" : formatNumber(Math.round(x), 0));

export const GMINA_TOPICS: [GminaTopic, ...GminaTopic[]] = [
  {
    key: "seniorzy",
    label: "Seniorzy",
    intro: "Jaka część mieszkańców gminy ma 65 lat lub więcej.",
    column: "Osoby w wieku 65+ (% mieszkańców)",
    field: "udzial_65plus",
    worse: "higher",
    format: (v) => formatValue(v, "%"),
    sentence: (v) => `${share(v, { one: "osoba", many: "osób" })} ma 65 lat lub więcej.`,
    compare: (d) =>
      d === 0 ? "Podobnie jak w większości gmin Małopolski."
        : d > 0 ? "To więcej niż w większości gmin Małopolski." : "To mniej niż w większości gmin Małopolski.",
    innovations: { area: "seniorzy", groups: ["seniorzy"], cross: [] },
  },
  {
    key: "ludnosc",
    label: "Zmiana liczby mieszkańców",
    intro:
      "Czy przez 10 lat mieszkańców przybyło, czy ubyło. Wyludnianie się gmin to jeden z tematów przekrojowych Mapy Wyzwań.",
    column: "Zmiana liczby mieszkańców w 10 lat (%)",
    field: "zmiana_ludnosci_10l",
    worse: "lower",
    format: (v) => `${v > 0 ? "+" : ""}${formatNumber(v, 1)}%`,
    sentence: (v) =>
      Math.abs(v) < 0.5 ? "Przez 10 lat liczba mieszkańców prawie się nie zmieniła."
        : v < 0 ? `Przez 10 lat ubyło ${perHundred(-v)} na 100 mieszkańców.`
        : `Przez 10 lat przybyło ${perHundred(v)} na 100 mieszkańców.`,
    // „Więcej/mniej” zależy od znaku: -0,5% przy medianie -1% to wciąż ubywanie, tylko wolniejsze.
    compare: (d, v) =>
      d === 0 ? "Podobnie jak w większości gmin Małopolski."
        : d > 0 ? (v > 0 ? "Przybywa więcej mieszkańców niż w większości gmin Małopolski." : "Ubywa mniej mieszkańców niż w większości gmin Małopolski.")
        : v < 0 ? "Ubywa więcej mieszkańców niż w większości gmin Małopolski." : "Przybywa mniej mieszkańców niż w większości gmin Małopolski.",
    // Wyjeżdżają głównie młodzi za pracą, a zostającym brakuje usług — stąd rynek pracy i dostęp do usług.
    innovations: { groups: ["rynek_pracy"], cross: ["depopulacja_suburbanizacja", "dostep_do_uslug"] },
  },
];

export function findGminaTopic(key: string | undefined): GminaTopic {
  return GMINA_TOPICS.find((t) => t.key === key) ?? GMINA_TOPICS[0];
}

// ── Liczby słowami ──────────────────────────────────────────

const ORDINAL_F = ["", "", "druga", "trzecia", "czwarta", "piąta", "szósta", "siódma", "ósma", "dziewiąta", "dziesiąta"];
const ORDINAL_M = ["", "", "drugi", "trzeci", "czwarty", "piąty", "szósty", "siódmy", "ósmy", "dziewiąty", "dziesiąty"];

/**
 * Procent jako „co czwarta osoba” (gdy to bliskie prawdy), inaczej „4 na 10 osób” albo „2 na 100 osób”.
 * one/many to podmiot w liczbie pojedynczej („osoba, której…”) i w dopełniaczu mnogiej („osób, którym…”).
 */
export function share(pct: number, who: { one: string; many: string; ord?: "f" | "m" }): string {
  const ordinals = who.ord === "m" ? ORDINAL_M : ORDINAL_F;
  const n = Math.round(100 / pct);
  if (pct > 9 && pct <= 55 && n >= 2 && n <= 10) {
    const error = Math.abs(100 / n - pct) / pct;
    if (error <= 0.12) return `${error > 0.03 ? "Mniej więcej co" : "Co"} ${ordinals[n]} ${who.one}`;
  }
  if (pct >= 10) return `${Math.round(pct / 10)} na 10 ${who.many}`;
  if (pct >= 0.5) return `${Math.round(pct)} na 100 ${who.many}`;
  return `Mniej niż 1 na 100 ${who.many}`;
}

/** Wartość z jednostką, po polsku: „23,3%”, „28 187 osób”. */
export function formatValue(value: number | null, unit: string): string {
  if (value == null) return "brak danych";
  const n = formatNumber(value, Math.abs(value) >= 100 ? 0 : 1);
  if (!unit) return n;
  if (unit.startsWith("%")) return `${n}${unit}`;
  return `${n} ${unit}`;
}

// ── Porównania między gminami ─────────────────────────────

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Wartość na tle mediany gmin: 1 wyraźnie więcej, -1 wyraźnie mniej, 0 podobnie (różnica poniżej 5%). */
export function regionDirection(value: number, values: number[]): -1 | 0 | 1 {
  const m = median(values);
  if (m === 0) return value > 0 ? 1 : value < 0 ? -1 : 0;
  if (Math.abs(value - m) / Math.abs(m) < 0.05) return 0;
  return value > m ? 1 : -1;
}

/** Czy wartość jest wyraźnie gorsza od mediany (ta sama miara co zdanie „więcej/mniej niż w większości”). */
export function worseThanRegion(value: number, values: number[], worse: Worse): boolean {
  const d = regionDirection(value, values);
  return worse === "higher" ? d > 0 : d < 0;
}

/**
 * Jak bardzo wartość jest „wyzwaniem” na tle regionu: 0 = najlepiej, 1 = najgorzej wśród gmin.
 * Remisy dostają średnią pozycję, żeby kolejność wierszy w bazie niczego nie zmieniała.
 */
export function badness(value: number, values: number[], worse: Worse): number {
  if (values.length < 2) return 0;
  const below = values.filter((v) => (worse === "higher" ? v < value : v > value)).length;
  const equal = values.filter((v) => v === value).length;
  return (below + (equal - 1) / 2) / (values.length - 1);
}

/** Zakres wartości w każdej klasie kartogramu — do legendy. */
export function classRanges(rows: { cls: number | null; value: number | null }[]): { c: number; lo: number; hi: number }[] {
  return Array.from({ length: CLASS_COUNT }, (_, c) => {
    const vs = rows.filter((r) => r.cls === c && r.value != null).map((r) => r.value as number);
    return vs.length ? { c, lo: Math.min(...vs), hi: Math.max(...vs) } : null;
  }).filter((r) => r != null);
}

/** Pięć klas do kartogramu (0 = najmniejsze wyzwanie). */
export const CLASS_COUNT = 5;
export function classOf(b: number): number {
  return Math.min(CLASS_COUNT - 1, Math.floor(b * CLASS_COUNT));
}
