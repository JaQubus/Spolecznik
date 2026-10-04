import { EMAIL, NIP_WEIGHTS, checksumOk, digits, getAt, parseAmount, setAt } from "./form-fields.ts";
import { formatFact } from "./implementation-plan.ts";
import { GRANT, type InstitutionType, type PlanDocument } from "./schemas.ts";
import type { UwContent } from "./uw-content.ts";

// Wniosek o grant do naboru „Usługa Wrażliwa” (#105, /wniosek-o-grant). Części I–VI jak we wzorze ROPS; merytoryczne
// wypełniamy z planu wdrożenia (/wdrozenie), dane wnioskodawcy i oświadczenia zostają dla użytkownika.
// Czyste funkcje bez importów serwerowych: działają w przeglądarce i w testach (tests/unit/uw-application.test.ts).

/** Miesiąc jako „RRRR-MM” (wartość <input type="month">). */
export type Month = string;
export type Row = { dzialanie: string; termin: string; koszt: string; uzasadnienie: string };
export type YearValue = { rok: string; k: string; m: string };
export type DeMinimis = "" | "nie_dotyczy" | "a" | "b";

/**
 * Bez danych osobowych (zasada projektu): wniosek zbiera tylko dane instytucji. Osobę upoważnioną i osobę do kontaktu
 * wnioskodawca wpisuje dopiero w formularzu elektronicznym ROPS. Stary szkic z tymi polami traci je przy wczytaniu (restore).
 */
export type GrantApplication = {
  innowacja: string; // tytuł z listy naboru
  status: string; // jeden z content.statuses
  wnioskodawca: {
    nazwa: string; adresSiedziby: string; adresFilii: string;
    korespondencjaTaSama: boolean; adresKorespondencji: string;
    telefon: string; email: string; nip: string; krs: string; www: string; social: string;
  };
  maRealizatora: boolean;
  realizator: { nazwa: string; adres: string; adresKorespondencji: string; telefon: string; email: string; nip: string; krs: string };
  doswiadczenie: { obszary: boolean[]; opis: string };
  tytul: string;
  opis: string;
  etap1: { od: Month; do: Month };
  etap2: { od: Month; do: Month };
  grupy: boolean[];
  diagnoza: string;
  rekrutacja: string;
  liczba: string;
  obszar: string;
  efekty: string;
  przygotowanie: Row[];
  wdrazanie: Row[];
  wskaznik: { lata: YearValue[]; pomiar: string };
  kwota: string;
  cross: "nie" | "tak";
  crossLista: string;
  trwaloscCross: string;
  horyzontalne: string;
  utrzymanie: string;
  deinstytucjonalizacja: string;
  oswiadczenia: boolean[];
  deMinimis: DeMinimis;
};

export const emptyRow = (): Row => ({ dzialanie: "", termin: "", koszt: "", uzasadnienie: "" });

const DEFAULT_MEASUREMENT =
  "Pomiar w chwili przystąpienia osoby do usługi, na podstawie formularzy zgłoszeniowych i list obecności, w podziale na kobiety i mężczyzn.";

export function emptyApplication(content: UwContent, start: Month): GrantApplication {
  const prepEnd = addMonths(start, GRANT.maxPreparationMonths - 1);
  return {
    innowacja: "",
    status: "",
    wnioskodawca: {
      nazwa: "", adresSiedziby: "", adresFilii: "", korespondencjaTaSama: true, adresKorespondencji: "",
      telefon: "", email: "", nip: "", krs: "", www: "", social: "",
    },
    maRealizatora: false,
    realizator: { nazwa: "", adres: "", adresKorespondencji: "", telefon: "", email: "", nip: "", krs: "" },
    doswiadczenie: { obszary: content.experience.areas.map(() => false), opis: "" },
    tytul: "",
    opis: "",
    etap1: { od: start, do: prepEnd },
    etap2: { od: addMonths(prepEnd, 1), do: addMonths(start, GRANT.maxMonths - 1) },
    grupy: content.targetGroups.map(() => false),
    diagnoza: "", rekrutacja: "", liczba: "", obszar: "", efekty: "",
    przygotowanie: [emptyRow()],
    wdrazanie: [emptyRow()],
    wskaznik: { lata: [], pomiar: DEFAULT_MEASUREMENT },
    kwota: "",
    cross: "nie", crossLista: "", trwaloscCross: "",
    horyzontalne: "", utrzymanie: "", deinstytucjonalizacja: "",
    oswiadczenia: content.declarations.items.map(() => false),
    deMinimis: "",
  };
}

// ---- Miesiące

const MONTHS = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isMonth = (m: string) => MONTH.test(m);

export function addMonths(m: Month, n: number): Month {
  const [y, mm] = m.split("-").map(Number);
  const i = y * 12 + (mm - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

/** Liczba miesięcy od `a` do `b` włącznie; 0, gdy daty są błędne albo w złej kolejności. */
export function monthSpan(a: Month, b: Month): number {
  if (!isMonth(a) || !isMonth(b)) return 0;
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return Math.max(0, (by - ay) * 12 + (bm - am) + 1);
}

export function monthLabel(m: Month): string {
  if (!isMonth(m)) return m;
  const [y, mm] = m.split("-").map(Number);
  return `${MONTHS[mm - 1]} ${y}`;
}

/** „lipiec–wrzesień 2026”, „listopad 2026 – luty 2027”, „maj 2027”. Tak jak przykłady we wzorze wniosku. */
export function rangeLabel(a: Month, b: Month): string {
  if (a === b) return monthLabel(a);
  const [ay] = a.split("-");
  const [by] = b.split("-");
  if (ay === by) return `${monthLabel(a).split(" ")[0]}–${monthLabel(b)}`;
  return `${monthLabel(a)} – ${monthLabel(b)}`;
}

/** Od wniosku do umowy mija kilka miesięcy (instrukcja ROPS), więc domyślny start to dzisiaj + 4 miesiące. */
export function defaultStart(today: string): Month {
  return addMonths(today.slice(0, 7), 4);
}

/** Lata, w których świadczona jest usługa — kolumny wskaźnika obligatoryjnego. */
export function serviceYears(etap2: { od: Month; do: Month }): string[] {
  if (monthSpan(etap2.od, etap2.do) === 0) return [];
  const from = Number(etap2.od.slice(0, 4));
  const to = Number(etap2.do.slice(0, 4));
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
}

/** Rozkład liczby osób na lata proporcjonalnie do miesięcy usługi w danym roku; reszta w ostatnim roku. */
export function spreadByYear(total: number, etap2: { od: Month; do: Month }): Record<string, number> {
  const years = serviceYears(etap2);
  const span = monthSpan(etap2.od, etap2.do);
  const out: Record<string, number> = {};
  let left = total;
  years.forEach((y, i) => {
    const from = y === etap2.od.slice(0, 4) ? etap2.od : `${y}-01`;
    const to = y === etap2.do.slice(0, 4) ? etap2.do : `${y}-12`;
    const share = i === years.length - 1 ? left : Math.round((total * monthSpan(from, to)) / span);
    out[y] = share;
    left -= share;
  });
  return out;
}

// ---- Wypełnienie z planu wdrożenia

/** Typ instytucji z formularza planu → status we wniosku. Organizacje i PES mają różne formy prawne: wybierają same. */
const STATUS_BY_INSTITUTION: Partial<Record<InstitutionType, number>> = { jst: 0, ops: 0, pcpr: 0, cus: 0 };

export function fromPlan(doc: PlanDocument, content: UwContent, innovationSlug: string | null, start: Month): GrantApplication {
  const app = emptyApplication(content, start);
  const p = doc.plan;
  const prep = p.steps.filter((s) => s.stage === "przygotowanie");
  const impl = p.steps.filter((s) => s.stage === "wdrozenie");
  const at = (month: number) => addMonths(start, month - 1);
  const span = (steps: typeof p.steps) => ({
    od: at(Math.min(...steps.map((s) => s.monthFrom))), do: at(Math.max(...steps.map((s) => s.monthTo))),
  });
  const row = (s: (typeof p.steps)[number]): Row => ({
    dzialanie: `${s.title}. ${s.details}`.trim(),
    termin: rangeLabel(at(s.monthFrom), at(s.monthTo)),
    koszt: String(Math.round(s.costPln)),
    uzasadnienie: s.costBasis,
  });
  const people = p.peopleSupported.women + p.peopleSupported.men;
  const status = STATUS_BY_INSTITUTION[doc.input.institutionType];

  app.innowacja = content.innovations.find((i) => i.slug === innovationSlug)?.title ?? "";
  app.status = status === undefined ? "" : content.statuses[status];
  app.tytul = `${doc.innovation.title} w gminie ${doc.gmina.nazwa}`;
  app.opis = [p.goal, p.description, `Forma usługi: ${p.serviceForm}`].join("\n\n");
  if (prep.length) app.etap1 = span(prep);
  if (impl.length) app.etap2 = span(impl);
  app.diagnoza = [
    p.audience.summary,
    p.audience.facts.length > 0 && `Dane o gminie ${doc.gmina.nazwa}:\n${p.audience.facts
      .map((f) => `- ${f.label}: ${formatFact(f)} (źródło: ${f.source}). ${f.why}`).join("\n")}`,
    `Liczba osób planowana do objęcia usługą: ${people} (szacunek: ${p.peopleSupported.basis})`,
  ].filter(Boolean).join("\n\n");
  app.rekrutacja = p.recruitment;
  app.liczba = `Liczba osób objętych usługą społeczną: ${people} (kobiety: ${p.peopleSupported.women}, mężczyźni: ${p.peopleSupported.men}).\nLiczba osób z kadry objętej wsparciem grantu: [DO UZUPEŁNIENIA]`;
  app.obszar = doc.gmina.label;
  app.efekty = [p.goal, ...p.successIndicators.map((i) => `- ${i}`)].join("\n");
  app.przygotowanie = prep.length ? prep.map(row) : [emptyRow()];
  app.wdrazanie = impl.length ? impl.map(row) : [emptyRow()];
  const women = spreadByYear(p.peopleSupported.women, app.etap2);
  const men = spreadByYear(p.peopleSupported.men, app.etap2);
  app.wskaznik.lata = serviceYears(app.etap2).map((rok) => ({ rok, k: String(women[rok] ?? 0), m: String(men[rok] ?? 0) }));
  app.kwota = String(Math.round(p.totalPln));
  app.horyzontalne = p.horizontalPrinciples;
  app.utrzymanie = p.sustainability;
  app.deinstytucjonalizacja = p.deinstitutionalization;
  return app;
}

/** Lata wskaźnika po zmianie dat etapu 2: zostawia wpisane liczby, dodaje brakujące lata, usuwa nadmiarowe. */
export function syncYears(lata: YearValue[], etap2: { od: Month; do: Month }): YearValue[] {
  const byYear = new Map(lata.map((l) => [l.rok, l]));
  return serviceYears(etap2).map((rok) => byYear.get(rok) ?? { rok, k: "", m: "" });
}

// ---- Szkic z localStorage

/** Szkic mógł powstać przy starszej wersji wzoru: uzupełniamy brakujące pola pustymi, tablice tniemy do treści naboru. */
export function restore(saved: unknown, content: UwContent, start: Month): GrantApplication {
  const base = emptyApplication(content, start);
  if (!saved || typeof saved !== "object") return base;
  const merge = (a: unknown, b: unknown): unknown => {
    if (Array.isArray(a)) return Array.isArray(b) ? b : a;
    if (a && typeof a === "object") {
      const src = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, merge(v, src[k])]));
    }
    return typeof b === typeof a ? b : a;
  };
  const app = merge(base, saved) as GrantApplication;
  const src = saved as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  for (const key of ["przygotowanie", "wdrazanie"] as const) {
    const rows = list(src[key]).map((r) => merge(emptyRow(), r) as Row);
    app[key] = rows.length ? rows : [emptyRow()];
  }
  app.wskaznik.lata = list((src.wskaznik as Record<string, unknown> | undefined)?.lata)
    .map((l) => merge({ rok: "", k: "", m: "" }, l) as YearValue);
  // Liczba oświadczeń, grup i obszarów musi się zgadzać z treścią naboru, inaczej zaczynamy od zera.
  const fit = (values: boolean[], length: number) => (values.length === length ? values : Array(length).fill(false));
  app.oswiadczenia = fit(app.oswiadczenia, content.declarations.items.length);
  app.grupy = fit(app.grupy, content.targetGroups.length);
  app.doswiadczenie.obszary = fit(app.doswiadczenie.obszary, content.experience.areas.length);
  return app;
}

// ---- Kwoty

export const filledRows = (rows: Row[]) => rows.filter((r) => r.dzialanie.trim() || r.termin.trim() || r.koszt.trim() || r.uzasadnienie.trim());

export function planTotal(app: GrantApplication): number {
  return [...app.przygotowanie, ...app.wdrazanie].reduce((sum, r) => sum + (parseAmount(r.koszt) ?? 0), 0);
}

export function indicatorTotals(app: GrantApplication) {
  const n = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : 0);
  const k = app.wskaznik.lata.reduce((sum, l) => sum + n(l.k), 0);
  const m = app.wskaznik.lata.reduce((sum, l) => sum + n(l.m), 0);
  return { k, m, total: k + m };
}

// ---- Dane wrażliwe w opisach

/**
 * Wniosek opisuje usługę i grupę odbiorców, nigdy konkretne osoby. PESEL, dowód czy numer konta podopiecznego
 * w opisie to wyciek danych osobowych do dokumentu, który czyta komisja, więc blokujemy przejście dalej.
 * Telefon i e-mail w opisie bywają służbowe (np. zapisy w GOPS), więc tylko prosimy o sprawdzenie.
 * Wzorce jak w lib/pii.ts (anonimizacja przed LLM): lepiej zgłosić za dużo niż przepuścić PESEL.
 */
const SENSITIVE: { kind: string; re: RegExp; block: boolean }[] = [
  { kind: "numer konta bankowego", re: /(?<!\d)(?:PL\s?)?\d{2}(?:[\s-]?\d{4}){6}(?!\d)/g, block: true },
  { kind: "numer karty płatniczej", re: /(?<!\d)\d{4}(?:[\s-]?\d{4}){3}(?!\d)/g, block: true },
  { kind: "numer PESEL", re: /(?<!\d)\d{11}(?!\d)/g, block: true },
  { kind: "numer dowodu osobistego", re: /\b[A-Z]{3}\s?\d{6}(?!\d)/g, block: true },
  { kind: "numer paszportu", re: /\b[A-Z]{2}\s?\d{7}(?!\d)/g, block: true },
  { kind: "adres e-mail", re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, block: false },
  { kind: "numer telefonu", re: /(?<![\d+])(?:\+?48[\s-]?)?(?:\d{3}[\s-]?\d{3}[\s-]?\d{3}|\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})(?!\d)/g, block: false },
];

/** Pola opisowe, które trafiają do wniosku. Dane kontaktowe podmiotu (krok 2) są wymagane przez wzór, więc ich nie skanujemy. */
export function descriptivePaths(app: GrantApplication): string[] {
  const rows = (key: "przygotowanie" | "wdrazanie") =>
    app[key].flatMap((_, i) => [`${key}.${i}.dzialanie`, `${key}.${i}.termin`, `${key}.${i}.uzasadnienie`]);
  return [
    "doswiadczenie.opis", "tytul", "opis", "diagnoza", "rekrutacja", "liczba", "obszar", "efekty",
    ...rows("przygotowanie"), ...rows("wdrazanie"), "wskaznik.pomiar", "crossLista", "trwaloscCross",
    "horyzontalne", "utrzymanie", "deinstytucjonalizacja",
  ];
}

export type Finding = { path: string; kind: string; block: boolean };

export function sensitiveFindings(app: GrantApplication, paths = descriptivePaths(app)): Finding[] {
  const out: Finding[] = [];
  for (const path of paths) {
    let text = String(getAt(app, path) ?? "");
    for (const { kind, re, block } of SENSITIVE) {
      if (!new RegExp(re.source, re.flags).test(text)) continue;
      out.push({ path, kind, block });
      text = text.replace(re, " "); // dłuższy numer (konto) nie liczy się drugi raz jako PESEL albo telefon
    }
  }
  return out;
}

/** Usuwa z opisów to, co blokuje wniosek (PESEL, dowód, konto, karta); telefony i e-maile zostają do decyzji. */
export function maskSensitive(app: GrantApplication): GrantApplication {
  let next = app;
  for (const path of descriptivePaths(app)) {
    const before = String(getAt(next, path) ?? "");
    let after = before;
    for (const { kind, re, block } of SENSITIVE) if (block) after = after.replace(re, `[usunięto: ${kind}]`);
    if (after !== before) next = setAt(next, path, after);
  }
  return next;
}

function blockSensitive(e: Errors, app: GrantApplication, paths: string[]) {
  for (const f of sensitiveFindings(app, paths)) {
    if (f.block && !e[f.path]) e[f.path] = `Usuń ${f.kind}: wniosek opisuje usługę, nie konkretne osoby.`;
  }
}

// ---- Kroki i walidacja

export const STEPS = [
  { id: "innowacja", title: "Innowacja i wnioskodawca" },
  { id: "dane", title: "Dane kontaktowe" },
  { id: "doswiadczenie", title: "Doświadczenie" },
  { id: "usluga", title: "Usługa i odbiorcy" },
  { id: "plan", title: "Plan, koszty i wskaźnik" },
  { id: "zasady", title: "Zasady i trwałość" },
  { id: "oswiadczenia", title: "Oświadczenia" },
  { id: "gotowe", title: "Sprawdź i pobierz" },
] as const;

export type Errors = Record<string, string>;

function required(e: Errors, app: GrantApplication, path: string, message: string) {
  if (!String(getAt(app, path) ?? "").trim()) e[path] = message;
}

function checkEmail(e: Errors, app: GrantApplication, path: string) {
  const v = String(getAt(app, path) ?? "").trim();
  if (!v) e[path] = "Wpisz adres e-mail.";
  else if (!EMAIL.test(v)) e[path] = "Wpisz adres e-mail w formacie nazwa@domena.pl.";
}

function checkPhone(e: Errors, app: GrantApplication, path: string) {
  const v = String(getAt(app, path) ?? "");
  if (!v.trim()) e[path] = "Wpisz numer telefonu.";
  else if (digits(v).length < 9) e[path] = "Wpisz numer telefonu, np. 12 422 06 36.";
}

function checkNip(e: Errors, app: GrantApplication, path: string) {
  const nip = digits(String(getAt(app, path) ?? ""));
  if (!nip) return; // „jeśli dotyczy”
  if (nip.length !== 10) e[path] = "NIP ma 10 cyfr. Jeśli nie dotyczy, zostaw puste.";
  else if (!checksumOk(nip, NIP_WEIGHTS, false)) e[path] = "Sprawdź NIP: w numerze jest literówka.";
}

function checkRows(e: Errors, app: GrantApplication, key: "przygotowanie" | "wdrazanie", atLeastOne: string) {
  const rows = app[key];
  rows.forEach((r, i) => {
    if (!(r.dzialanie.trim() || r.termin.trim() || r.koszt.trim() || r.uzasadnienie.trim())) return;
    if (!r.dzialanie.trim()) e[`${key}.${i}.dzialanie`] = "Opisz, co zrobisz.";
    if (!r.termin.trim()) e[`${key}.${i}.termin`] = "Wpisz termin, np. „lipiec 2027”.";
    if (parseAmount(r.koszt) === null) e[`${key}.${i}.koszt`] = "Wpisz koszt w złotych, np. 1200.";
    if (!r.uzasadnienie.trim()) e[`${key}.${i}.uzasadnienie`] = "Napisz, jak policzono koszt, np. „12 h × 100 zł”.";
  });
  if (!rows.some((r) => r.dzialanie.trim())) e[`${key}.0.dzialanie`] = atLeastOne;
}

function checkMonth(e: Errors, app: GrantApplication, path: string, label: string) {
  if (!isMonth(String(getAt(app, path) ?? ""))) e[path] = `Wybierz miesiąc i rok: ${label}.`;
}

export function validateStep(step: number, app: GrantApplication, content: UwContent): Errors {
  const e: Errors = {};
  switch (STEPS[step].id) {
    case "innowacja":
      if (!content.innovations.some((i) => i.title === app.innowacja)) e.innowacja = "Wybierz innowację z listy naboru.";
      if (!content.statuses.includes(app.status)) e.status = "Wybierz status wnioskodawcy.";
      break;
    case "dane": {
      const w = "wnioskodawca";
      required(e, app, `${w}.nazwa`, "Wpisz nazwę podmiotu.");
      required(e, app, `${w}.adresSiedziby`, "Wpisz adres siedziby.");
      if (!app.wnioskodawca.korespondencjaTaSama) required(e, app, `${w}.adresKorespondencji`, "Wpisz adres do korespondencji.");
      checkPhone(e, app, `${w}.telefon`);
      checkEmail(e, app, `${w}.email`);
      checkNip(e, app, `${w}.nip`);
      if (app.maRealizatora) {
        required(e, app, "realizator.nazwa", "Wpisz nazwę realizatora.");
        required(e, app, "realizator.adres", "Wpisz adres realizatora.");
        checkPhone(e, app, "realizator.telefon");
        checkEmail(e, app, "realizator.email");
        checkNip(e, app, "realizator.nip");
      }
      break;
    }
    case "doswiadczenie":
      if (!app.doswiadczenie.obszary.some(Boolean)) e["doswiadczenie.obszary"] = "Zaznacz co najmniej jeden obszar, w którym masz 3 lata doświadczenia.";
      required(e, app, "doswiadczenie.opis", "Opisz swoje doświadczenie.");
      blockSensitive(e, app, ["doswiadczenie.opis"]);
      break;
    case "usluga":
      required(e, app, "tytul", "Wpisz tytuł usługi.");
      required(e, app, "opis", "Opisz usługę.");
      checkMonth(e, app, "etap1.od", "początek przygotowania");
      checkMonth(e, app, "etap1.do", "koniec przygotowania");
      checkMonth(e, app, "etap2.od", "początek wdrażania");
      checkMonth(e, app, "etap2.do", "koniec wdrażania");
      if (!e["etap1.do"] && !e["etap1.od"] && monthSpan(app.etap1.od, app.etap1.do) === 0) e["etap1.do"] = "Koniec przygotowania musi być po jego początku.";
      if (!e["etap2.od"] && !e["etap1.do"] && app.etap2.od <= app.etap1.do) e["etap2.od"] = "Wdrażanie zaczyna się po zakończeniu przygotowania.";
      if (!e["etap2.do"] && !e["etap2.od"] && monthSpan(app.etap2.od, app.etap2.do) === 0) e["etap2.do"] = "Koniec wdrażania musi być po jego początku.";
      if (!app.grupy.some(Boolean)) e.grupy = "Zaznacz co najmniej jedną grupę docelową.";
      required(e, app, "diagnoza", "Opisz problem i odbiorców.");
      required(e, app, "rekrutacja", "Opisz rekrutację.");
      required(e, app, "liczba", "Podaj liczbę osób objętych wsparciem.");
      required(e, app, "obszar", "Podaj obszar wdrażania.");
      required(e, app, "efekty", "Opisz oczekiwane efekty.");
      blockSensitive(e, app, ["tytul", "opis", "diagnoza", "rekrutacja", "liczba", "obszar", "efekty"]);
      break;
    case "plan": {
      checkRows(e, app, "przygotowanie", "Dodaj co najmniej jedno działanie przygotowawcze.");
      checkRows(e, app, "wdrazanie", "Dodaj co najmniej jedno działanie we wdrażaniu.");
      app.wskaznik.lata.forEach((l, i) => {
        if (!/^\d+$/.test(l.k.trim())) e[`wskaznik.lata.${i}.k`] = `Wpisz liczbę kobiet w ${l.rok} r., np. 0.`;
        if (!/^\d+$/.test(l.m.trim())) e[`wskaznik.lata.${i}.m`] = `Wpisz liczbę mężczyzn w ${l.rok} r., np. 0.`;
      });
      required(e, app, "wskaznik.pomiar", "Napisz, jak zmierzysz liczbę osób.");
      const amount = parseAmount(app.kwota);
      if (amount === null || amount <= 0) e.kwota = "Wpisz kwotę grantu w złotych, np. 250000.";
      if (app.cross === "tak") {
        required(e, app, "crossLista", "Wypisz wydatki w ramach cross-financingu.");
        required(e, app, "trwaloscCross", "Opisz, jak utrzymasz trwałość tych wydatków.");
      }
      blockSensitive(e, app, descriptivePaths(app).filter((p) => /^(przygotowanie|wdrazanie|wskaznik|crossLista|trwaloscCross)/.test(p)));
      break;
    }
    case "zasady":
      required(e, app, "horyzontalne", "Opisz, jak przestrzegasz zasad horyzontalnych.");
      required(e, app, "utrzymanie", "Opisz, jak utrzymasz efekty po grancie.");
      required(e, app, "deinstytucjonalizacja", "Uzasadnij zgodność z zasadą deinstytucjonalizacji.");
      blockSensitive(e, app, ["horyzontalne", "utrzymanie", "deinstytucjonalizacja"]);
      break;
    case "oswiadczenia":
      if (app.oswiadczenia.some((v) => !v)) e.oswiadczenia = "Zaznacz wszystkie oświadczenia. Bez nich wniosek nie zostanie przyjęty.";
      if (!app.deMinimis) e.deMinimis = "Wybierz jedną odpowiedź o pomocy de minimis.";
      break;
  }
  return e;
}

export function firstInvalidStep(app: GrantApplication, content: UwContent): number | null {
  for (let i = 0; i < STEPS.length - 1; i++) if (Object.keys(validateStep(i, app, content)).length) return i;
  return null;
}

// ---- Lista kontrolna pod kartę oceny formalnej (sprawdzana w kodzie, nie przez model)

export type Check = { label: string; status: "ok" | "blad" | "sprawdz"; detail: string };

export function formalChecks(app: GrantApplication, content: UwContent, today: string): Check[] {
  const total = planTotal(app);
  const amount = parseAmount(app.kwota);
  const all = monthSpan(app.etap1.od, app.etap2.do);
  const prep = monthSpan(app.etap1.od, app.etap1.do);
  const service = monthSpan(app.etap2.od, app.etap2.do);
  const invalid = firstInvalidStep(app, content);
  // Po treści, nie po numerze: w kolejnym naborze oświadczenia mogą mieć inną kolejność.
  const fees = content.declarations.items.findIndex((t) => /nie będzie pobiera[ćc] opłat/i.test(t));
  const pln = (n: number) => `${n.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł`;
  const check = (label: string, ok: boolean, good: string, bad: string): Check =>
    ({ label, status: ok ? "ok" : "blad", detail: ok ? good : bad });
  const findings = sensitiveFindings(app);
  const blocking = findings.filter((f) => f.block);
  const contacts = [...new Set(findings.filter((f) => !f.block).map((f) => f.kind))];
  const sensitive: Check = blocking.length
    ? { label: "Brak danych osobowych w opisach (PESEL, dowód, numer konta)", status: "blad",
        detail: `Znaleziono: ${[...new Set(blocking.map((f) => f.kind))].join(", ")}. Usuń je przed złożeniem.` }
    : contacts.length
      ? { label: "Brak danych osobowych w opisach (PESEL, dowód, numer konta)", status: "sprawdz",
          detail: `W opisach jest ${contacts.join(" i ")}. Zostaw tylko służbowe dane instytucji, nie prywatne dane osób.` }
      : { label: "Brak danych osobowych w opisach (PESEL, dowód, numer konta)", status: "ok", detail: "Nie znaleziono." };
  return [
    sensitive,
    check("Wszystkie wymagane pola są wypełnione", invalid === null, "Tak.",
      invalid === null ? "" : `Brakuje danych w kroku „${STEPS[invalid].title}”.`),
    check("Innowacja jest na liście naboru", content.innovations.some((i) => i.title === app.innowacja),
      app.innowacja, "Wybierz jedną z innowacji tego naboru."),
    check(`Kwota grantu nie przekracza ${pln(GRANT.maxPln)}`, amount !== null && amount <= GRANT.maxPln,
      amount !== null ? pln(amount) : "", amount === null ? "Nie wpisano kwoty." : `Wpisano ${pln(amount)}.`),
    check("Budżet jest poprawny rachunkowo (kwota = suma kosztów działań)", amount !== null && Math.abs(amount - total) < 0.01,
      `Suma działań: ${pln(total)}.`, `Kwota ${amount === null ? "—" : pln(amount)}, a suma działań ${pln(total)}.`),
    check(`Całość trwa najwyżej ${GRANT.maxMonths} miesięcy`, all > 0 && all <= GRANT.maxMonths,
      `${all} mies.`, all === 0 ? "Uzupełnij daty etapów." : `Wychodzi ${all} mies.`),
    check(`Przygotowanie trwa najwyżej ${GRANT.maxPreparationMonths} miesięcy`, prep > 0 && prep <= GRANT.maxPreparationMonths,
      `${prep} mies.`, prep === 0 ? "Uzupełnij daty przygotowania." : `Wychodzi ${prep} mies.`),
    check(`Usługa jest świadczona co najmniej ${GRANT.minServiceMonths} miesięcy`, service >= GRANT.minServiceMonths,
      `${service} mies.`, service === 0 ? "Uzupełnij daty wdrażania." : `Wychodzi ${service} mies.`),
    check("Grupa docelowa należy do kategorii z regulaminu", app.grupy.some(Boolean),
      `${app.grupy.filter(Boolean).length} z ${content.targetGroups.length} kategorii.`, "Zaznacz grupę docelową."),
    check("Nie przewidujesz opłat od uczestników ani kadry", fees >= 0 && app.oswiadczenia[fees] === true,
      `Potwierdzone w oświadczeniu ${fees + 1}.`, fees >= 0 ? `Potwierdź oświadczenie ${fees + 1}.` : "Brak oświadczenia o opłatach we wzorze."),
    today > content.call.closesAt
      ? { label: "Termin naboru", status: "sprawdz", detail: `Ten nabór zakończył się ${formatDay(content.call.closesAt)}. Sprawdź na stronie ROPS, czy trwa kolejny.` }
      : { label: "Termin naboru", status: "ok", detail: `Wnioski do ${formatDay(content.call.closesAt)}.` },
  ];
}

const formatDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
