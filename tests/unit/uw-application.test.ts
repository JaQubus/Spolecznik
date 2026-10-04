import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { checkPlan } from "../../lib/implementation-plan.ts";
import type { ImplementationPlan, PlanDocument } from "../../lib/schemas.ts";
import { UwContent } from "../../lib/uw-content.ts";
import {
  addMonths, firstInvalidStep, formalChecks, fromPlan, monthSpan, rangeLabel, restore, spreadByYear, syncYears, validateStep, STEPS,
} from "../../lib/uw-application.ts";

const content = UwContent.parse(JSON.parse(readFileSync(new URL("../../data/usluga_wrazliwa_wniosek.json", import.meta.url), "utf8")));

const step = (stage: "przygotowanie" | "wdrozenie", monthFrom: number, monthTo: number, costPln: number) => ({
  stage, title: `Działanie ${monthFrom}`, details: "Opis.", monthFrom, monthTo, costPln, costBasis: "10 h × 100 zł",
});

const raw: ImplementationPlan = {
  goal: "Seniorzy bezpieczni w domu.",
  description: "Domowa diagnoza i plan zmian w mieszkaniu.",
  serviceForm: "W ramach CUS.",
  audience: { summary: "Seniorzy mieszkający samotnie.", facts: [{ factId: "osoby_65plus", why: "Główni odbiorcy." }] },
  peopleSupported: { women: 30, men: 20, basis: "Połowa zgłoszeń z OPS." },
  recruitment: "Przez OPS i parafie.",
  steps: [step("przygotowanie", 1, 3, 20_000), step("przygotowanie", 3, 6, 30_000), step("wdrozenie", 7, 18, 200_000)],
  staffAndResources: "Terapeuta zajęciowy.",
  costEstimate: { minPln: 200_000, maxPln: 300_000, basis: "Z działań." },
  partners: [], partnerTypes: [],
  risks: [], successIndicators: ["50 seniorów objętych usługą"],
  horizontalPrinciples: "Dostępność.", sustainability: "Gmina przejmie koszty.", deinstitutionalization: "Usługa w domu.",
  assumptions: [],
};

const facts = [{ id: "osoby_65plus", label: "Osoby w wieku 65+", value: 850, unit: "osób", source: "wyliczone (BDL GUS, 2025)" }];
const doc: PlanDocument = {
  id: "00000000-0000-4000-8000-000000000000",
  createdAt: "2026-10-04T10:00:00Z",
  innovation: { id: "i1", title: "Terapeuta przestrzeni" },
  gmina: { teryt: "1208072", nazwa: "Słaboszów", label: "Słaboszów (gmina wiejska, powiat miechowski)" },
  input: { institutionType: "ops", budget: "100_300" },
  plan: checkPlan(raw, { facts, partners: [], budget: "100_300" }),
};

describe("miesiące", () => {
  test("dodawanie przez koniec roku i długość okresu włącznie", () => {
    assert.equal(addMonths("2026-11", 3), "2027-02");
    assert.equal(monthSpan("2027-01", "2027-06"), 6);
    assert.equal(monthSpan("2027-07", "2028-06"), 12);
    assert.equal(monthSpan("2027-06", "2027-01"), 0);
    assert.equal(monthSpan("2027-13", "2028-01"), 0);
  });

  test("terminy jak w przykładach wzoru", () => {
    assert.equal(rangeLabel("2027-07", "2027-09"), "lipiec–wrzesień 2027");
    assert.equal(rangeLabel("2026-11", "2027-02"), "listopad 2026 – luty 2027");
    assert.equal(rangeLabel("2027-05", "2027-05"), "maj 2027");
  });

  test("osoby rozłożone na lata według miesięcy usługi, reszta w ostatnim roku", () => {
    assert.deepEqual(spreadByYear(30, { od: "2027-05", do: "2028-04" }), { 2027: 20, 2028: 10 });
    assert.deepEqual(spreadByYear(7, { od: "2027-01", do: "2027-12" }), { 2027: 7 });
  });

  test("lata wskaźnika idą za datami, wpisane liczby zostają", () => {
    const lata = syncYears([{ rok: "2027", k: "5", m: "4" }], { od: "2027-07", do: "2028-06" });
    assert.deepEqual(lata, [{ rok: "2027", k: "5", m: "4" }, { rok: "2028", k: "", m: "" }]);
  });
});

describe("fromPlan", () => {
  const app = fromPlan(doc, content, "terapeuta-przestrzeni", "2027-01");

  test("etapy z miesięcy planu liczone od daty startu", () => {
    assert.deepEqual(app.etap1, { od: "2027-01", do: "2027-06" });
    assert.deepEqual(app.etap2, { od: "2027-07", do: "2028-06" });
    assert.equal(app.przygotowanie[0].termin, "styczeń–marzec 2027");
    assert.equal(app.wdrazanie[0].termin, "lipiec 2027 – czerwiec 2028");
    assert.equal(app.wdrazanie[0].uzasadnienie, "10 h × 100 zł");
  });

  test("innowacja z listy naboru, status z typu instytucji, kwota równa sumie działań", () => {
    assert.equal(app.innowacja, "Terapeuta przestrzeni");
    assert.equal(app.status, "Jednostka sektora finansów publicznych");
    assert.equal(app.kwota, "250000");
  });

  test("diagnoza z faktami o gminie i ich źródłem, wskaźnik sumuje się do liczby osób", () => {
    assert.match(app.diagnoza, /Osoby w wieku 65\+: 850 osób \(źródło: wyliczone \(BDL GUS, 2025\)\)/);
    const sum = app.wskaznik.lata.reduce((s, l) => s + Number(l.k) + Number(l.m), 0);
    assert.equal(sum, 50);
    assert.deepEqual(app.wskaznik.lata.map((l) => l.rok), ["2027", "2028"]);
  });

  test("organizacja wybiera status sama; innowacja spoza naboru zostaje pusta", () => {
    const ngo = fromPlan({ ...doc, input: { institutionType: "ngo", budget: "nie_wiem" } }, content, "senior-cuder", "2027-01");
    assert.equal(ngo.status, "");
    assert.equal(ngo.innowacja, "");
  });

  test("z planu brakuje tylko danych wnioskodawcy, doświadczenia, grup i oświadczeń", () => {
    assert.equal(STEPS[firstInvalidStep(app, content)!].id, "dane");
    assert.deepEqual(Object.keys(validateStep(STEPS.findIndex((s) => s.id === "usluga"), app, content)), ["grupy"]);
    assert.deepEqual(Object.keys(validateStep(STEPS.findIndex((s) => s.id === "plan"), app, content)), []);
  });
});

describe("formalChecks", () => {
  const app = fromPlan(doc, content, "terapeuta-przestrzeni", "2027-01");
  const statusOf = (a: typeof app, label: RegExp, today = "2026-06-01") =>
    formalChecks(a, content, today).find((c) => label.test(c.label))!.status;

  test("plan w limitach naboru przechodzi warunki czasu i budżetu", () => {
    assert.equal(statusOf(app, /nie przekracza/), "ok");
    assert.equal(statusOf(app, /rachunkowo/), "ok");
    assert.equal(statusOf(app, /Całość/), "ok");
    assert.equal(statusOf(app, /Przygotowanie/), "ok");
    assert.equal(statusOf(app, /co najmniej 12/), "ok");
  });

  test("kwota ponad 600 tys. i różna od sumy działań to dwa błędy", () => {
    const big = { ...app, kwota: "700000" };
    assert.equal(statusOf(big, /nie przekracza/), "blad");
    assert.equal(statusOf(big, /rachunkowo/), "blad");
  });

  test("usługa krótsza niż 12 miesięcy i przygotowanie dłuższe niż 6", () => {
    const short = { ...app, etap1: { od: "2027-01", do: "2027-08" }, etap2: { od: "2027-09", do: "2028-03" } };
    assert.equal(statusOf(short, /Przygotowanie/), "blad");
    assert.equal(statusOf(short, /co najmniej 12/), "blad");
  });

  test("brak opłat wymaga zaznaczenia oświadczenia o opłatach", () => {
    assert.equal(statusOf(app, /opłat/), "blad");
    const fees = content.declarations.items.findIndex((t) => /nie będzie pobiera/.test(t));
    const signed = { ...app, oswiadczenia: app.oswiadczenia.map((v, i) => i === fees || v) };
    assert.equal(statusOf(signed, /opłat/), "ok");
  });

  test("po terminie naboru: do sprawdzenia, nie błąd", () => {
    assert.equal(statusOf(app, /Termin naboru/, "2026-10-04"), "sprawdz");
    assert.equal(statusOf(app, /Termin naboru/, "2026-06-01"), "ok");
  });
});

describe("restore", () => {
  test("szkic ze starszej wersji wzoru: brakujące pola puste, oświadczenia od nowa przy innej liczbie", () => {
    const app = restore({ tytul: "Mój tytuł", oswiadczenia: [true, true], przygotowanie: [{ dzialanie: "A" }] }, content, "2027-01");
    assert.equal(app.tytul, "Mój tytuł");
    assert.equal(app.oswiadczenia.length, content.declarations.items.length);
    assert.ok(app.oswiadczenia.every((v) => v === false));
    assert.deepEqual(app.przygotowanie, [{ dzialanie: "A", termin: "", koszt: "", uzasadnienie: "" }]);
    assert.equal(app.wnioskodawca.kontaktTenSam, true);
  });
});
