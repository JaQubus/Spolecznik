import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkPlan, planToText } from "../../lib/transfer-plan.ts";
import { TransferPlan, type GminaFact, type PlanDocument } from "../../lib/schemas.ts";
import { region } from "../../lib/brand.ts";

const facts: GminaFact[] = [
  { id: "ludnosc", label: "Liczba mieszkańców", value: 28187, unit: "osób", source: "BDL GUS, 2025" },
  { id: "osoby_65plus", label: "Osoby w wieku 65+", value: 6342, unit: "osób", source: "wyliczone: liczba mieszkańców × udział 65+ (BDL GUS, 2025)" },
];

const step = (stage: "przygotowanie" | "uruchomienie", monthFrom: number, monthTo: number, costPln: number) => ({
  stage, title: `Działanie ${stage} ${monthFrom}`, details: "Opis.", monthFrom, monthTo, costPln, costBasis: "10 h × 100 zł",
});

const raw: TransferPlan = {
  goal: "Uczniowie z małych szkół programują roboty.",
  description: "Wspólny zestaw robotów krąży między szkołami.",
  adaptation: "Mniej szkół w gminie, więc jeden zestaw wystarczy.",
  audience: {
    summary: "Uczniowie klas 4–8.",
    facts: [
      { factId: "ludnosc", why: "Mała gmina." },
      { factId: "wymyslony", why: "Model wymyślił ten fakt." },
      { factId: "ludnosc", why: "Powtórzony." },
    ],
  },
  peopleReached: { count: 120, basis: "Szacunek z liczby szkół." },
  steps: [step("uruchomienie", 4, 12, 15_000), step("przygotowanie", 1, 2, 3_000), step("przygotowanie", 2, 3, 2_000)],
  staffAndResources: "Nauczyciel informatyki.",
  costEstimate: { minPln: 25_000, maxPln: 15_000, basis: "Z kosztów działań." },
  partners: [{ id: "m1", role: "Szkolenie nauczycieli" }, { id: "nieznany", role: "Wymyślony" }],
  partnerTypes: ["uczelnia techniczna z regionu"],
  risks: [{ risk: "Zepsuty sprzęt", mitigation: "Zapasowe części" }],
  successIndicators: ["120 uczniów na zajęciach"],
  sustainability: "Gmina kupuje części z budżetu oświaty.",
  assumptions: ["Szkoły mają laptopy."],
};

describe("checkPlan", () => {
  test("odpowiedź modelu przechodzi schemat", () => {
    assert.ok(TransferPlan.safeParse(raw).success);
  });

  test("liczby o gminie tylko z faktów: nieznane i powtórzone id odpadają, wartość i źródło z profilu", () => {
    const plan = checkPlan(raw, { facts, partners: [{ id: "m1", name: "Mentorka edukacji cyfrowej" }], budget: "nie_wiem" });
    assert.equal(plan.audience.facts.length, 1);
    assert.equal(plan.audience.facts[0].value, 28187);
    assert.match(plan.audience.facts[0].source, /BDL GUS/);
  });

  test("partnerzy tylko z bazy, z nazwą; typy partnerów znikają, gdy są partnerzy", () => {
    const plan = checkPlan(raw, { facts, partners: [{ id: "m1", name: "Mentorka" }], budget: "nie_wiem" });
    assert.deepEqual(plan.partners, [{ id: "m1", name: "Mentorka", role: "Szkolenie nauczycieli" }]);
    assert.deepEqual(plan.partnerTypes, []);
    const none = checkPlan(raw, { facts, partners: [], budget: "nie_wiem" });
    assert.deepEqual(none.partners, []);
    assert.deepEqual(none.partnerTypes, ["uczelnia techniczna z regionu"]);
  });

  test("kroki po etapach i miesiącach, suma kosztów, widełki od mniejszej", () => {
    const plan = checkPlan(raw, { facts, partners: [], budget: "nie_wiem" });
    assert.deepEqual(plan.steps.map((s) => [s.stage, s.monthFrom]), [["przygotowanie", 1], ["przygotowanie", 2], ["uruchomienie", 4]]);
    assert.equal(plan.totalPln, 20_000);
    assert.deepEqual([plan.costEstimate.minPln, plan.costEstimate.maxPln], [15_000, 25_000]);
    assert.deepEqual(plan.warnings, []);
  });

  test("widełki rozszerzone tak, żeby obejmowały sumę kosztów działań", () => {
    const plan = checkPlan({ ...raw, costEstimate: { minPln: 5_000, maxPln: 10_000, basis: "" } }, { facts, partners: [], budget: "nie_wiem" });
    assert.deepEqual([plan.costEstimate.minPln, plan.costEstimate.maxPln], [5_000, 20_000]);
  });

  test("ramy pilotażu trafiają do uwag, a nie są poprawiane po cichu", () => {
    const long = { ...raw, steps: [step("przygotowanie", 1, 5, 5_000), step("uruchomienie", 6, 30, 10_000), step("uruchomienie", 0, 2, 0)] };
    const plan = checkPlan(long, { facts, partners: [], budget: "nie_wiem" });
    assert.equal(plan.steps.at(-1)!.monthTo, 12); // miesiące przycięte do 1–12
    assert.equal(plan.warnings.length, 1);
    assert.match(plan.warnings[0], /Przygotowanie trwa 5 mies/);
  });

  test("plan bez uruchomienia daje uwagę", () => {
    const prepOnly = { ...raw, steps: [step("przygotowanie", 1, 2, 1_000), step("przygotowanie", 2, 3, 1_000), step("przygotowanie", 3, 3, 0)] };
    const plan = checkPlan(prepOnly, { facts, partners: [], budget: "nie_wiem" });
    assert.match(plan.warnings[0], /nie ma etapu uruchomienia/);
  });

  test("suma powyżej wybranego budżetu daje uwagę", () => {
    const plan = checkPlan(raw, { facts, partners: [], budget: "do_20" });
    assert.deepEqual(plan.warnings, []);
    const pricey = checkPlan({ ...raw, steps: [...raw.steps, step("uruchomienie", 5, 6, 40_000)] }, { facts, partners: [], budget: "20_50" });
    assert.match(pricey.warnings[0], /przekracza wybrany budżet \(20–50 tys\. zł\)/);
  });
});

describe("planToText", () => {
  test("ma sekcje planu, źródła liczb i oznaczenia szacunku", () => {
    const g = region.municipalityExample;
    const doc: PlanDocument = {
      id: null,
      createdAt: "2026-10-04T10:00:00Z",
      source: { kind: "initiative", id: "i1", title: "Robotyka w małych szkołach", href: "/innowacje/robotyka" },
      gmina: { teryt: g.teryt, nazwa: g.name, label: `${g.name} (gmina, powiat ${g.county})` },
      input: { institutionType: "szkola_podstawowa", budget: "do_20" },
      plan: checkPlan(raw, { facts, partners: [], budget: "do_20" }),
    };
    const text = planToText(doc);
    assert.match(text, /SZKIC PLANU PRZENIESIENIA: Robotyka w małych szkołach/);
    assert.match(text, /Liczba mieszkańców: 28\s?187 osób \(źródło: BDL GUS/);
    assert.match(text, /LICZBA ODBIORCÓW \(SZACUNEK\): 120/);
    assert.match(text, /CO ZOSTANIE PO PILOTAŻU/);
    assert.match(text, /ZAŁOŻENIA PRZYJĘTE/);
  });
});
