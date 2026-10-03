/**
 * Kondycja Małopolski: które wskaźniki powiatów (tabela powiaty_wskazniki) opisują który obszar
 * Mapy Wyzwań i jak zamienić liczbę na zdanie prostym językiem. Zdania są liczone z danych
 * deterministycznie — bez LLM — więc zawsze zgadzają się z tabelą obok.
 */
import { formatNumber } from "./pl";
import type { CROSS, GROUPS, MWS_AREAS } from "./schemas";
import { AREA_LABELS } from "./taxonomy";

type Area = (typeof MWS_AREAS)[number];
type Group = (typeof GROUPS)[number];
type Cross = (typeof CROSS)[number];

export type Indicator = {
  /** Nazwa wskaźnika dokładnie jak w powiaty_wskazniki.wskaznik. */
  key: string;
  /** Krótka etykieta prostym językiem (nagłówek kolumny). */
  label: string;
  /** Która strona skali oznacza większe wyzwanie — od tego zależy kolor na mapie i „najgorszy obszar”. */
  worse: "higher" | "lower";
};

export type KondycjaArea = {
  area: Area;
  /** Nazwa tematu, gdy dane pokrywają tylko część obszaru Mapy Wyzwań (domyślnie nazwa obszaru). */
  label?: string;
  /** Jedno zdanie o tym, co pokazują dane. */
  intro: string;
  /** Pierwszy wskaźnik jest główny: koloruje mapę i daje zdanie o powiecie. */
  indicators: [Indicator, ...Indicator[]];
  /** Zdanie o powiecie z wartości głównego wskaźnika. */
  sentence: (value: number) => string;
  /** Grupy Biblioteki dla innowacji pasujących do obszaru (gdy innowacja nie ma jeszcze obszarów z enrich.py). */
  groups: Group[];
};

const OPS = { one: "osoba, której pomaga ośrodek pomocy społecznej,", many: "osób, którym pomaga ośrodek pomocy społecznej," };

export const KONDYCJA_AREAS: KondycjaArea[] = [
  {
    area: "seniorzy",
    intro: "Ilu jest seniorów i ile osób może się nimi opiekować w rodzinie.",
    indicators: [
      { key: "Ludność w wieku 60+", label: "Osoby w wieku 60+ (% mieszkańców)", worse: "higher" },
      { key: "Wskaźnik/ indeks starości", label: "Osoby 65+ na 100 dzieci do 14 lat", worse: "higher" },
      { key: "Potencjał pielęgnacyjny", label: "Kobiety 45–64 lata na 100 osób w wieku 80+ (możliwe opiekunki)", worse: "lower" },
    ],
    sentence: (v) => `${share(v, { one: "osoba", many: "osób" })} ma 60 lat lub więcej.`,
    groups: ["seniorzy"],
  },
  {
    area: "rodzina_piecza",
    intro: "Ile dzieci wychowuje się poza domem rodzinnym i jak często rodziny potrzebują pomocy w wychowaniu.",
    indicators: [
      { key: "Intensywność pieczy zastępczej", label: "Dzieci w pieczy zastępczej na 1000 dzieci", worse: "higher" },
      {
        key: "Bezradność w sprawach opiekuńczo-wychowawczych i prowadzenia gosp. dom.",
        label: "Pomoc OPS z powodu trudności w wychowaniu dzieci (% osób wspieranych)",
        worse: "higher",
      },
    ],
    sentence: (v) => `${perThousand(v)} na 1000 dzieci mieszka w pieczy zastępczej, czyli poza domem rodzinnym.`,
    groups: ["dzieci_mlodziez_rodzina"],
  },
  {
    area: "ubostwo",
    intro: "Ilu mieszkańców korzysta z pomocy społecznej i jak wyglądają zarobki i bezrobocie.",
    indicators: [
      { key: "Beneficjenci pomocy społecznej", label: "Mieszkańcy korzystający z pomocy społecznej (%)", worse: "higher" },
      { key: "Przeciętne wynagrodzenie w relacji do śr. krajowej", label: "Przeciętne wynagrodzenie (średnia w Polsce = 100)", worse: "lower" },
      { key: "Stopa bezrobocia", label: "Stopa bezrobocia (%)", worse: "higher" },
    ],
    sentence: (v) => `${share(v, { one: "mieszkaniec", many: "mieszkańców", ord: "m" })} korzysta z pomocy społecznej.`,
    groups: ["rynek_pracy"],
  },
  {
    area: "niepelnosprawnosc",
    intro: "Jak często ośrodki pomocy społecznej wspierają osoby z powodu niepełnosprawności.",
    indicators: [
      { key: "Niepełnosprawność", label: "Pomoc OPS z powodu niepełnosprawności (% osób wspieranych)", worse: "higher" },
    ],
    sentence: (v) => `${share(v, OPS)} dostaje wsparcie z powodu niepełnosprawności.`,
    groups: ["ograniczona_mobilnosc", "niepelnosprawnosc_sensoryczna", "niepelnosprawnosc_intelektualna"],
  },
  {
    area: "zdrowie",
    intro: "Jak często powodem pomocy jest choroba i jak daleko jest do apteki.",
    indicators: [
      { key: "Długotrwała lub ciężka choroba", label: "Pomoc OPS z powodu długiej lub ciężkiej choroby (% osób wspieranych)", worse: "higher" },
      { key: "Dostępność aptek", label: "Mieszkańcy na jedną aptekę", worse: "higher" },
    ],
    sentence: (v) => `${share(v, OPS)} dostaje wsparcie z powodu długiej lub ciężkiej choroby.`,
    groups: ["zdrowie_medycyna"],
  },
  {
    area: "zdrowie_psychiczne",
    // Jedyny wskaźnik to alkoholizm, więc nie nazywamy tego „zdrowiem psychicznym” — to byłoby nadużycie.
    label: "Uzależnienie od alkoholu",
    intro:
      "Jak często powodem pomocy jest uzależnienie od alkoholu. To tylko część obszaru „Zdrowie psychiczne” z Mapy Wyzwań: innych danych o zdrowiu psychicznym dla powiatów nie mamy.",
    indicators: [
      { key: "Alkoholizm", label: "Pomoc OPS z powodu uzależnienia od alkoholu (% osób wspieranych)", worse: "higher" },
    ],
    sentence: (v) => `${share(v, OPS)} dostaje wsparcie z powodu uzależnienia od alkoholu.`,
    groups: ["zdrowie_medycyna"],
  },
  {
    area: "bezdomnosc",
    intro: "Jak często powodem pomocy jest bezdomność.",
    indicators: [
      { key: "Bezdomność", label: "Pomoc OPS z powodu bezdomności (% osób wspieranych)", worse: "higher" },
    ],
    sentence: (v) => `${share(v, OPS)} dostaje wsparcie z powodu bezdomności.`,
    groups: ["bezdomnosc"],
  },
];

export function areaLabel(a: KondycjaArea): string {
  return a.label ?? AREA_LABELS[a.area];
}

/**
 * Temat nazywamy „wyzwaniem” powiatu dopiero wtedy, gdy powiat wypada w nim gorzej niż połowa powiatów.
 * Drugi temat pokazujemy, gdy jest prawie tak samo źle jak pierwszy.
 */
export const CHALLENGE_MIN = 0.5;
export const CHALLENGE_TIE = 0.1;

// ── Gminy (tabela gminy, dane BDL z data/bdl.py) ────────────

export type GminaField = "udzial_65plus" | "zmiana_ludnosci_10l";

export type GminaTopic = {
  key: string;
  label: string;
  intro: string;
  /** Nagłówek kolumny w tabeli. */
  column: string;
  field: GminaField;
  worse: Indicator["worse"];
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

export const POPULATION_KEY = "Ludność ogółem";

/** Wszystkie wskaźniki potrzebne na stronie (do jednego zapytania). */
export const KONDYCJA_KEYS = [POPULATION_KEY, ...KONDYCJA_AREAS.flatMap((a) => a.indicators.map((i) => i.key))];

export function findArea(area: string | undefined): KondycjaArea {
  return KONDYCJA_AREAS.find((a) => a.area === area) ?? KONDYCJA_AREAS[0];
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

function perThousand(v: number): string {
  return v < 1 ? "Mniej niż 1" : formatNumber(Math.round(v), 0);
}

/** Wartość z jednostką, po polsku: „23,3%”, „3566 mieszkańców na 1 aptekę”. */
export function formatValue(value: number | null, unit: string): string {
  if (value == null) return "brak danych";
  const n = formatNumber(value, Math.abs(value) >= 100 ? 0 : 1);
  if (!unit) return n;
  if (unit.startsWith("%")) return `${n}${unit}`;
  return `${n} ${unit}`;
}

/** Wartość pod etykietą, która już mówi, w czym liczymy: zostaje tylko znak procentu. */
export function formatBare(value: number | null, unit: string): string {
  return formatValue(value, unit === "%" ? "%" : "");
}

// ── Porównania między powiatami ─────────────────────────────

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Wartość na tle mediany powiatów: 1 wyraźnie więcej, -1 wyraźnie mniej, 0 podobnie (różnica poniżej 5%). */
export function regionDirection(value: number, values: number[]): -1 | 0 | 1 {
  const m = median(values);
  if (m === 0) return value > 0 ? 1 : value < 0 ? -1 : 0;
  if (Math.abs(value - m) / Math.abs(m) < 0.05) return 0;
  return value > m ? 1 : -1;
}

/** Porównanie z medianą powiatów prostymi słowami. */
export function compareToRegion(value: number, values: number[]): string {
  const d = regionDirection(value, values);
  if (d === 0) return "Podobnie jak w większości powiatów Małopolski.";
  return d > 0 ? "To więcej niż w większości powiatów Małopolski." : "To mniej niż w większości powiatów Małopolski.";
}

/** Czy wartość jest wyraźnie gorsza od mediany (ta sama miara co zdanie „więcej/mniej niż w większości”). */
export function worseThanRegion(value: number, values: number[], worse: Indicator["worse"]): boolean {
  const d = regionDirection(value, values);
  return worse === "higher" ? d > 0 : d < 0;
}

/**
 * Jak bardzo wartość jest „wyzwaniem” na tle regionu: 0 = najlepiej, 1 = najgorzej wśród powiatów.
 * Remisy dostają średnią pozycję, żeby kolejność wierszy w bazie niczego nie zmieniała.
 */
export function badness(value: number, values: number[], worse: Indicator["worse"]): number {
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
