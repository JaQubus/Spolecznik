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

/** Liczby gminy: kolumny tabeli gminy + dodatkowe wskaźniki BDL w gminy.wskazniki (data/bdl.py). */
export type GminaValues = {
  udzial_65plus: number | null;
  zmiana_ludnosci_10l: number | null;
  wskazniki: Record<string, unknown>;
};

/** Wskaźnik z gminy.wskazniki jako liczba (jsonb może mieć null albo brak klucza). */
const extra = (key: string) => (g: GminaValues): number | null => {
  const v = g.wskazniki?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

const regionWords = (d: -1 | 0 | 1) =>
  d === 0 ? "Podobnie jak w większości gmin Małopolski."
    : d > 0 ? "To więcej niż w większości gmin Małopolski." : "To mniej niż w większości gmin Małopolski.";

/** Porównanie dla wartości ze znakiem (+/−): „ubywa mniej” to co innego niż „przybywa mniej”. */
const flowWords = (d: -1 | 0 | 1, v: number, how: string) =>
  d === 0 ? "Podobnie jak w większości gmin Małopolski."
    : d > 0 ? (v > 0 ? `Przybywa więcej mieszkańców${how} niż w większości gmin Małopolski.` : `Ubywa mniej mieszkańców${how} niż w większości gmin Małopolski.`)
    : v < 0 ? `Ubywa więcej mieszkańców${how} niż w większości gmin Małopolski.` : `Przybywa mniej mieszkańców${how} niż w większości gmin Małopolski.`;

const signed = (v: number, digits = 1) => `${v > 0 ? "+" : ""}${formatNumber(v, digits)}`;

export type GminaTopic = {
  key: string;
  label: string;
  intro: string;
  /** Nagłówek kolumny w tabeli. */
  column: string;
  get: (g: GminaValues) => number | null;
  worse: Worse;
  format: (v: number) => string;
  sentence: (v: number) => string;
  /** Porównanie z medianą gmin; d jak w regionDirection. */
  compare: (d: -1 | 0 | 1, v: number) => string;
  /** Jakie innowacje podsunąć gminie, w której temat wypada źle. */
  innovations: { area?: Area; groups: Group[]; cross: Cross[] };
};

/** „6”, a poniżej 1 „mniej niż 1” — do zdań typu „ubyło 6 na 100 mieszkańców”. */
const rounded = (x: number) => (x < 1 ? "mniej niż 1" : formatNumber(Math.round(x), 0));

export const GMINA_TOPICS: [GminaTopic, ...GminaTopic[]] = [
  {
    key: "seniorzy",
    label: "Seniorzy",
    intro: "Jaka część mieszkańców gminy ma 65 lat lub więcej.",
    column: "Osoby w wieku 65+ (% mieszkańców)",
    get: (g) => g.udzial_65plus,
    worse: "higher",
    format: (v) => formatValue(v, "%"),
    sentence: (v) => `${share(v, { one: "osoba", many: "osób" })} ma 65 lat lub więcej.`,
    compare: regionWords,
    innovations: { area: "seniorzy", groups: ["seniorzy"], cross: ["samotnosc"] },
  },
  {
    key: "ludnosc",
    label: "Zmiana liczby mieszkańców",
    intro:
      "Czy przez 10 lat mieszkańców przybyło, czy ubyło. Wyludnianie się gmin to jeden z tematów przekrojowych Mapy Wyzwań.",
    column: "Zmiana liczby mieszkańców w 10 lat (%)",
    get: (g) => g.zmiana_ludnosci_10l,
    worse: "lower",
    format: (v) => `${signed(v)}%`,
    sentence: (v) =>
      Math.abs(v) < 0.5 ? "Przez 10 lat liczba mieszkańców prawie się nie zmieniła."
        : v < 0 ? `Przez 10 lat ubyło ${rounded(-v)} na 100 mieszkańców.`
        : `Przez 10 lat przybyło ${rounded(v)} na 100 mieszkańców.`,
    // „Więcej/mniej” zależy od znaku: -0,5% przy medianie -1% to wciąż ubywanie, tylko wolniejsze.
    compare: (d, v) => flowWords(d, v, ""),
    // Wyjeżdżają głównie młodzi za pracą, a zostającym brakuje usług — stąd rynek pracy i dostęp do usług.
    innovations: { groups: ["rynek_pracy"], cross: ["depopulacja_suburbanizacja", "dostep_do_uslug"] },
  },
  {
    key: "przeprowadzki",
    label: "Przeprowadzki",
    intro: "Czy więcej osób się do gminy wprowadza, czy z niej wyprowadza (saldo migracji na 1000 mieszkańców w ciągu roku).",
    column: "Saldo migracji na 1000 mieszkańców",
    get: extra("saldo_migracji_1000"),
    worse: "lower",
    format: (v) => signed(v),
    sentence: (v) =>
      Math.abs(v) < 0.5 ? "Mniej więcej tyle samo osób się wprowadza, co wyprowadza."
        : v < 0 ? `Więcej osób się wyprowadza, niż wprowadza: w rok ubywa tak ${rounded(-v)} na 1000 mieszkańców.`
        : `Więcej osób się wprowadza, niż wyprowadza: w rok przybywa tak ${rounded(v)} na 1000 mieszkańców.`,
    compare: (d, v) => flowWords(d, v, " przez przeprowadzki"),
    innovations: { groups: ["rynek_pracy", "dzieci_mlodziez_rodzina"], cross: ["depopulacja_suburbanizacja"] },
  },
  {
    key: "urodzenia",
    label: "Urodzenia i zgony",
    intro: "Czy w gminie rodzi się więcej dzieci, niż umiera osób (przyrost naturalny na 1000 mieszkańców w ciągu roku).",
    column: "Przyrost naturalny na 1000 mieszkańców",
    get: extra("przyrost_naturalny_1000"),
    worse: "lower",
    format: (v) => signed(v),
    sentence: (v) =>
      Math.abs(v) < 0.5 ? "Rodzi się mniej więcej tyle dzieci, ile umiera osób."
        : v < 0 ? `Umiera więcej osób, niż rodzi się dzieci: w rok ubywa tak ${rounded(-v)} na 1000 mieszkańców.`
        : `Rodzi się więcej dzieci, niż umiera osób: w rok przybywa tak ${rounded(v)} na 1000 mieszkańców.`,
    compare: (d, v) => flowWords(d, v, " przez urodzenia i zgony"),
    innovations: { area: "seniorzy", groups: ["dzieci_mlodziez_rodzina"], cross: [] },
  },
  {
    key: "pomoc",
    label: "Pomoc społeczna",
    intro: "Ilu mieszkańców korzysta z pomocy ośrodka pomocy społecznej (na 10 tys. mieszkańców).",
    column: "Osoby korzystające z pomocy społecznej na 10 tys. mieszkańców",
    get: extra("pomoc_spoleczna_10k"),
    worse: "higher",
    format: (v) => formatNumber(v, 0),
    sentence: (v) => `${share(v / 100, { one: "mieszkaniec", many: "mieszkańców", ord: "m" })} korzysta z pomocy społecznej.`,
    compare: regionWords,
    innovations: { area: "ubostwo", groups: ["rynek_pracy", "bezdomnosc"], cross: ["dostep_do_uslug"] },
  },
  {
    key: "bezrobocie",
    label: "Bezrobocie",
    intro: "Jaka część osób w wieku produkcyjnym jest zarejestrowana w urzędzie pracy jako bezrobotna.",
    column: "Bezrobotni zarejestrowani (% osób w wieku produkcyjnym)",
    get: extra("bezrobocie_proc"),
    worse: "higher",
    format: (v) => formatValue(v, "%"),
    sentence: (v) =>
      `${v < 0.5 ? "Mniej niż 1" : formatNumber(Math.round(v), 0)} na 100 osób w wieku produkcyjnym to bezrobotni zarejestrowani w urzędzie pracy.`,
    compare: regionWords,
    innovations: { area: "ubostwo", groups: ["rynek_pracy"], cross: [] },
  },
  {
    key: "przedszkola",
    label: "Przedszkola",
    intro: "Jaka część dzieci w wieku 3–5 lat chodzi do przedszkola albo innej formy wychowania przedszkolnego.",
    column: "Dzieci 3–5 lat w przedszkolu (%)",
    get: extra("przedszkola_proc"),
    worse: "lower",
    format: (v) => formatValue(v, "%"),
    sentence: (v) =>
      v >= 100 ? "Do przedszkoli w gminie chodzą wszystkie dzieci w wieku 3–5 lat, a do tego część dzieci z sąsiednich gmin."
        : `${share(v, { one: "dziecko w wieku 3–5 lat", many: "dzieci w wieku 3–5 lat" })} chodzi do przedszkola.`,
    compare: regionWords,
    innovations: { area: "rodzina_piecza", groups: ["dzieci_mlodziez_rodzina"], cross: ["dostep_do_uslug"] },
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
