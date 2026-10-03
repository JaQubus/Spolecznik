import type { DeclarationSet, DescriptionKey } from "./form-content";
import { DESCRIPTION_SECTIONS, DECLARATIONS } from "./form-content";

export type ApplicantType = "osoba" | "podmiot" | "grupa";

export type Person = { imie: string; nazwisko: string; adres: string; kod: string; miejscowosc: string; telefon: string; email: string };
export type Contact = { funkcja: string; imieNazwisko: string; telefon: string; email: string };
export type Entity = {
  nazwa: string; krs: string; regon: string; nip: string;
  adres: string; kod: string; miejscowosc: string; telefon: string; email: string;
  reprezentant: Contact;
  kontaktTenSam: boolean;
  kontakt: Contact;
};
export type Partner = { rodzaj: "osoba" | "podmiot"; osoba: Person; podmiot: Entity };
export type PlanRow = { dzialanie: string; termin: string; koszt: string };

export type Application = {
  tytul: string;
  typ: ApplicantType;
  osoba: Person;
  podmiot: Entity;
  partnerzy: Partner[];
  reprezentantGrupy: { imieNazwisko: string; telefon: string; email: string };
  opisy: Record<DescriptionKey, string>;
  przygotowanie: PlanRow[];
  faza1: PlanRow[];
  faza2: PlanRow[];
  kwota: string;
  zespol: string;
  oswiadczenia: Record<DeclarationSet, boolean[]>;
};

export const MAX_PARTNERS = 5;

const emptyPerson = (): Person => ({ imie: "", nazwisko: "", adres: "", kod: "", miejscowosc: "", telefon: "", email: "" });
const emptyContact = (): Contact => ({ funkcja: "", imieNazwisko: "", telefon: "", email: "" });
const emptyEntity = (): Entity => ({
  nazwa: "", krs: "", regon: "", nip: "", adres: "", kod: "", miejscowosc: "", telefon: "", email: "",
  reprezentant: emptyContact(), kontaktTenSam: true, kontakt: emptyContact(),
});
export const emptyPartner = (): Partner => ({ rodzaj: "osoba", osoba: emptyPerson(), podmiot: emptyEntity() });
export const emptyRow = (): PlanRow => ({ dzialanie: "", termin: "", koszt: "" });

export function emptyApplication(): Application {
  return {
    tytul: "",
    typ: "osoba",
    osoba: emptyPerson(),
    podmiot: emptyEntity(),
    partnerzy: [emptyPartner(), emptyPartner()],
    reprezentantGrupy: { imieNazwisko: "", telefon: "", email: "" },
    opisy: Object.fromEntries(DESCRIPTION_SECTIONS.map((s) => [s.key, ""])) as Record<DescriptionKey, string>,
    przygotowanie: [emptyRow()],
    faza1: [emptyRow()],
    faza2: [emptyRow()],
    kwota: "",
    zespol: "",
    oswiadczenia: { A: DECLARATIONS.A.items.map(() => false), B: DECLARATIONS.B.items.map(() => false) },
  };
}

/** Szkic z localStorage mógł powstać przy starszej wersji formularza: uzupełniamy brakujące pola pustymi. */
export function restore(saved: unknown): Application {
  const base = emptyApplication();
  if (!saved || typeof saved !== "object") return base;
  const merge = (a: unknown, b: unknown): unknown => {
    if (Array.isArray(a)) return Array.isArray(b) ? b : a;
    if (a && typeof a === "object") {
      const src = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, merge(v, src[k])]));
    }
    return typeof b === typeof a ? b : a;
  };
  const app = merge(base, saved) as Application;
  // Liczba oświadczeń musi się zgadzać z treścią, inaczej odznaczamy wszystko.
  for (const set of ["A", "B"] as const) {
    if (app.oswiadczenia[set].length !== DECLARATIONS[set].items.length) app.oswiadczenia[set] = base.oswiadczenia[set];
  }
  return app;
}

// ---- Ścieżki pól: „osoba.imie”, „partnerzy.0.podmiot.nip”, „faza1.2.koszt”. Z nich powstają też id pól.

export function getAt(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

export function setAt<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const cur = obj as Record<string, unknown> | unknown[];
  const next = rest.length ? setAt(Array.isArray(cur) ? cur[Number(head)] : cur[head], rest.join("."), value) : value;
  if (Array.isArray(cur)) return cur.map((v, i) => (i === Number(head) ? next : v)) as T;
  return { ...cur, [head]: next } as T;
}

export const fieldId = (path: string) => `pole-${path.replace(/\./g, "-")}`;

// ---- Kwoty

/** „1 500,50 zł” → 1500.5; puste albo błędne → null. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/\s|zł|pln/gi, "").replace(",", ".");
  if (!s || !/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

export const formatPLN = (n: number) =>
  n.toLocaleString("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2 });

export function planTotal(app: Application): number {
  return [...app.przygotowanie, ...app.faza1, ...app.faza2].reduce((sum, r) => sum + (parseAmount(r.koszt) ?? 0), 0);
}

export const filledRows = (rows: PlanRow[]) => rows.filter((r) => r.dzialanie.trim() || r.termin.trim() || r.koszt.trim());

/** Kto podpisuje oświadczenia: A — osoby fizyczne, B — reprezentanci podmiotów. */
export function declarationSets(app: Application): DeclarationSet[] {
  if (app.typ === "osoba") return ["A"];
  if (app.typ === "podmiot") return ["B"];
  const kinds = new Set(app.partnerzy.map((p) => p.rodzaj));
  return (["A", "B"] as const).filter((s) => kinds.has(s === "A" ? "osoba" : "podmiot"));
}

// ---- Kroki i walidacja

export const STEPS = [
  { id: "pomysl", title: "Pomysł i wnioskodawca" },
  { id: "dane", title: "Dane kontaktowe" },
  { id: "opis", title: "Opis pomysłu" },
  { id: "plan", title: "Plan i koszty" },
  { id: "zespol", title: "Zespół" },
  { id: "oswiadczenia", title: "Oświadczenia" },
  { id: "gotowe", title: "Sprawdź i pobierz" },
] as const;

export type Errors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digits = (s: string) => s.replace(/\D/g, "");

function required(e: Errors, app: Application, path: string, message: string) {
  if (!String(getAt(app, path) ?? "").trim()) e[path] = message;
}

function checkEmail(e: Errors, app: Application, path: string) {
  const v = String(getAt(app, path) ?? "").trim();
  if (!v) e[path] = "Wpisz adres e-mail.";
  else if (!EMAIL.test(v)) e[path] = "Wpisz adres e-mail w formacie nazwa@domena.pl.";
}

function checkPhone(e: Errors, app: Application, path: string) {
  const v = String(getAt(app, path) ?? "");
  if (!v.trim()) e[path] = "Wpisz numer telefonu.";
  else if (digits(v).length < 9) e[path] = "Wpisz numer telefonu, np. 600 100 200.";
}

function checkAddress(e: Errors, app: Application, base: string) {
  required(e, app, `${base}.adres`, "Wpisz ulicę i numer.");
  const kod = String(getAt(app, `${base}.kod`) ?? "").trim();
  if (!kod) e[`${base}.kod`] = "Wpisz kod pocztowy.";
  else if (!/^\d{2}-\d{3}$/.test(kod)) e[`${base}.kod`] = "Wpisz kod pocztowy w formacie 30-070.";
  required(e, app, `${base}.miejscowosc`, "Wpisz miejscowość.");
  checkPhone(e, app, `${base}.telefon`);
  checkEmail(e, app, `${base}.email`);
}

function checkPerson(e: Errors, app: Application, base: string) {
  required(e, app, `${base}.imie`, "Wpisz imię.");
  required(e, app, `${base}.nazwisko`, "Wpisz nazwisko.");
  checkAddress(e, app, base);
}

function checkContact(e: Errors, app: Application, base: string) {
  required(e, app, `${base}.funkcja`, "Wpisz funkcję, np. „prezes zarządu”.");
  required(e, app, `${base}.imieNazwisko`, "Wpisz imię i nazwisko.");
  checkPhone(e, app, `${base}.telefon`);
  checkEmail(e, app, `${base}.email`);
}

function checkEntity(e: Errors, app: Application, base: string) {
  const ent = getAt(app, base) as Entity;
  required(e, app, `${base}.nazwa`, "Wpisz nazwę organizacji.");
  if (ent.krs.trim() && digits(ent.krs).length !== 10) e[`${base}.krs`] = "Numer KRS ma 10 cyfr. Jeśli go nie masz, zostaw puste.";
  if (![9, 14].includes(digits(ent.regon).length)) e[`${base}.regon`] = "Wpisz REGON: 9 albo 14 cyfr.";
  if (digits(ent.nip).length !== 10) e[`${base}.nip`] = "Wpisz NIP: 10 cyfr.";
  checkAddress(e, app, base);
  checkContact(e, app, `${base}.reprezentant`);
  if (!ent.kontaktTenSam) checkContact(e, app, `${base}.kontakt`);
}

function checkRows(e: Errors, app: Application, key: "przygotowanie" | "faza1" | "faza2", atLeastOne: string | null) {
  const rows = app[key];
  const any = rows.some((r) => r.dzialanie.trim());
  rows.forEach((r, i) => {
    const filled = r.dzialanie.trim() || r.termin.trim() || r.koszt.trim();
    if (!filled) return;
    if (!r.dzialanie.trim()) e[`${key}.${i}.dzialanie`] = "Opisz, co zrobisz.";
    if (!r.termin.trim()) e[`${key}.${i}.termin`] = "Wpisz termin, np. „maj–czerwiec 2026”.";
    if (parseAmount(r.koszt) === null) e[`${key}.${i}.koszt`] = "Wpisz koszt w złotych, np. 2500 albo 0.";
  });
  if (atLeastOne && !any) e[`${key}.0.dzialanie`] = atLeastOne;
}

export function validateStep(step: number, app: Application): Errors {
  const e: Errors = {};
  switch (STEPS[step].id) {
    case "pomysl":
      required(e, app, "tytul", "Wpisz tytuł pomysłu.");
      break;
    case "dane":
      if (app.typ === "osoba") checkPerson(e, app, "osoba");
      if (app.typ === "podmiot") checkEntity(e, app, "podmiot");
      if (app.typ === "grupa") {
        app.partnerzy.forEach((p, i) =>
          p.rodzaj === "osoba" ? checkPerson(e, app, `partnerzy.${i}.osoba`) : checkEntity(e, app, `partnerzy.${i}.podmiot`));
        required(e, app, "reprezentantGrupy.imieNazwisko", "Wpisz imię i nazwisko osoby do kontaktu.");
        checkPhone(e, app, "reprezentantGrupy.telefon");
        checkEmail(e, app, "reprezentantGrupy.email");
      }
      break;
    case "opis":
      for (const s of DESCRIPTION_SECTIONS) required(e, app, `opisy.${s.key}`, `Uzupełnij punkt „${s.title}”.`);
      break;
    case "plan": {
      checkRows(e, app, "przygotowanie", "Dodaj co najmniej jedno działanie przygotowawcze.");
      checkRows(e, app, "faza1", "Dodaj co najmniej jedno działanie w I fazie testu.");
      checkRows(e, app, "faza2", null);
      const amount = parseAmount(app.kwota);
      if (amount === null || amount <= 0) e.kwota = "Wpisz kwotę grantu w złotych, np. 45000.";
      break;
    }
    case "zespol":
      required(e, app, "zespol", "Napisz, kto będzie realizować pomysł.");
      break;
    case "oswiadczenia":
      for (const set of declarationSets(app)) {
        if (app.oswiadczenia[set].some((v) => !v)) e[`oswiadczenia.${set}`] = "Zaznacz wszystkie oświadczenia. Bez nich wniosek nie zostanie przyjęty.";
      }
      break;
  }
  return e;
}

/** Pierwszy krok z błędami, żeby przed pobraniem odesłać tam użytkownika. */
export function firstInvalidStep(app: Application): number | null {
  for (let i = 0; i < STEPS.length - 1; i++) if (Object.keys(validateStep(i, app)).length) return i;
  return null;
}
