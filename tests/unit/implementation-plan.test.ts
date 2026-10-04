import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkPlan, planToText } from "../../lib/implementation-plan.ts";
import { ImplementationPlan, type GminaFact, type PlanDocument } from "../../lib/schemas.ts";

const facts: GminaFact[] = [
  { id: "ludnosc", label: "Liczba mieszkańców", value: 28187, unit: "osób", source: "BDL GUS, 2025" },
  { id: "osoby_65plus", label: "Osoby w wieku 65+", value: 6342, unit: "osób", source: "wyliczone: liczba mieszkańców × udział 65+ (BDL GUS, 2025)" },
];

const step = (stage: "przygotowanie" | "wdrozenie", monthFrom: number, monthTo: number, costPln: number) => ({
  stage, title: `Działanie ${stage} ${monthFrom}`, details: "Opis.", monthFrom, monthTo, costPln, costBasis: "10 h × 100 zł",
});

const raw: ImplementationPlan = {
  goal: "Seniorzy mniej samotni.",
  description: "Usługa sąsiedzka.",
  serviceForm: "W ramach GOPS.",
  audience: {
    summary: "Samotni seniorzy.",
    facts: [
      { factId: "osoby_65plus", why: "To główni odbiorcy." },
      { factId: "wymyslony", why: "Model wymyślił ten fakt." },
      { factId: "osoby_65plus", why: "Powtórzony." },
    ],
  },
  peopleSupported: { women: 30, men: 20, basis: "Szacunek." },
  recruitment: "Przez GOPS.",
  steps: [step("wdrozenie", 7, 18, 200_000), step("przygotowanie", 1, 3, 20_000), step("przygotowanie", 3, 6, 30_000)],
  staffAndResources: "Koordynator.",
  costEstimate: { minPln: 300_000, maxPln: 200_000, basis: "Z kosztów działań." },
  partners: [{ id: "e1", role: "Szkolenia" }, { id: "nieznany", role: "Wymyślony" }],
  partnerTypes: ["lokalna organizacja seniorów"],
  risks: [{ risk: "Mało chętnych", mitigation: "Rekrutacja przez parafię" }],
  successIndicators: ["50 osób objętych usługą"],
  horizontalPrinciples: "Dostępność.",
  sustainability: "Gmina przejmie koszty.",
  deinstitutionalization: "Usługa w domu.",
  assumptions: ["Gmina ma salę."],
};

describe("checkPlan", () => {
  test("odpowiedź modelu przechodzi schemat", () => {
    assert.ok(ImplementationPlan.safeParse(raw).success);
  });

  test("liczby o gminie tylko z faktów: nieznane i powtórzone id odpadają, wartość i źródło z profilu", () => {
    const plan = checkPlan(raw, { facts, partners: [{ id: "e1", name: "Fundacja X" }], budget: "nie_wiem" });
    assert.equal(plan.audience.facts.length, 1);
    assert.equal(plan.audience.facts[0].value, 6342);
    assert.match(plan.audience.facts[0].source, /BDL GUS/);
  });

  test("partnerzy tylko z bazy, z nazwą; typy partnerów znikają, gdy są partnerzy", () => {
    const plan = checkPlan(raw, { facts, partners: [{ id: "e1", name: "Fundacja X" }], budget: "nie_wiem" });
    assert.deepEqual(plan.partners, [{ id: "e1", name: "Fundacja X", role: "Szkolenia" }]);
    assert.deepEqual(plan.partnerTypes, []);
    const none = checkPlan(raw, { facts, partners: [], budget: "nie_wiem" });
    assert.deepEqual(none.partners, []);
    assert.deepEqual(none.partnerTypes, ["lokalna organizacja seniorów"]);
  });

  test("kroki po etapach i miesiącach, suma kosztów, widełki od mniejszej", () => {
    const plan = checkPlan(raw, { facts, partners: [], budget: "nie_wiem" });
    assert.deepEqual(plan.steps.map((s) => [s.stage, s.monthFrom]), [["przygotowanie", 1], ["przygotowanie", 3], ["wdrozenie", 7]]);
    assert.equal(plan.totalPln, 250_000);
    assert.deepEqual([plan.costEstimate.minPln, plan.costEstimate.maxPln], [200_000, 300_000]);
    assert.deepEqual(plan.warnings, []);
  });

  test("widełki rozszerzone tak, żeby obejmowały sumę kosztów działań", () => {
    const plan = checkPlan({ ...raw, costEstimate: { minPln: 100_000, maxPln: 150_000, basis: "" } }, { facts, partners: [], budget: "nie_wiem" });
    assert.deepEqual([plan.costEstimate.minPln, plan.costEstimate.maxPln], [100_000, 250_000]);
  });

  test("limity naboru trafiają do uwag, a nie są poprawiane po cichu", () => {
    const long = { ...raw, steps: [step("przygotowanie", 1, 8, 50_000), step("wdrozenie", 9, 30, 700_000), step("wdrozenie", 0, 2, 0)] };
    const plan = checkPlan(long, { facts, partners: [], budget: "nie_wiem" });
    assert.equal(plan.steps.at(-1)!.monthTo, 18); // miesiące przycięte do 1–18
    assert.equal(plan.warnings.length, 2);
    assert.match(plan.warnings[0], /Przygotowanie trwa 8 mies/);
    assert.match(plan.warnings[1], /przekracza maksymalny grant/);
  });

  test("usługa krótsza niż 12 miesięcy daje uwagę", () => {
    const short = { ...raw, steps: [step("przygotowanie", 1, 6, 10_000), step("wdrozenie", 7, 12, 10_000), step("wdrozenie", 13, 14, 0)] };
    const plan = checkPlan(short, { facts, partners: [], budget: "nie_wiem" });
    assert.deepEqual(plan.warnings, ["Usługa trwa 8 mies., a nabór wymaga co najmniej 12. Wydłuż etap wdrażania."]);
  });

  test("suma powyżej wybranego budżetu daje uwagę", () => {
    const plan = checkPlan(raw, { facts, partners: [], budget: "do_100" });
    assert.match(plan.warnings[0], /przekracza wybrany budżet \(do 100 tys\. zł\)/);
  });
});

describe("planToText", () => {
  test("ma sekcje wniosku, źródła liczb i oznaczenia szacunku", () => {
    const doc: PlanDocument = {
      id: null,
      createdAt: "2026-10-04T10:00:00Z",
      innovation: { id: "i1", title: "Sąsiedzka pomoc" },
      gmina: { teryt: "1201011", nazwa: "Bochnia", label: "Bochnia (gmina miejska, powiat bocheński)" },
      input: { institutionType: "ops", budget: "100_300" },
      plan: checkPlan(raw, { facts, partners: [], budget: "100_300" }),
    };
    const text = planToText(doc);
    assert.match(text, /Osoby w wieku 65\+: 6\s?342 osób \(źródło: wyliczone/);
    assert.match(text, /LICZBA OSÓB OBJĘTYCH WSPARCIEM \(SZACUNEK\): 50/);
    assert.match(text, /UTRZYMANIE EFEKTÓW PO ZAKOŃCZENIU GRANTU/);
    assert.match(text, /ZAŁOŻENIA PRZYJĘTE/);
  });
});
