import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  applyRules, buildAssessment, maturityCap, radarCardLines, quoteInCard, radarConfidence, radarSignal, readAssessment, weightsKey,
  type RawDimension,
} from "../../lib/radar/score.ts";
import { RADAR, RADAR_KEYS, type RadarKey } from "../../lib/taxonomy.ts";

const CARD = {
  title: "Stanowisko do testów silników elektrycznych",
  summary: "Uczniowie technikum zbudowali stanowisko z silnika z rozbitego auta.",
  problem: "Szkoły zawodowe nie mają sprzętu do nauki napraw aut elektrycznych.",
  solution: "Stanowisko ze sterownikiem na otwartym oprogramowaniu. Instrukcję udostępniono innym szkołom.",
  effects: "Dwie inne szkoły zbudowały kopię według instrukcji.",
  beneficiaries: null,
  stage: "dziala", innovationKind: "technologiczna", sectors: ["motoryzacja"], trl: 7, ipStatus: "open",
};
const TEXT = radarCardLines(CARD).join("\n");

const dim = (score: number, evidence = "Dwie inne szkoły zbudowały kopię", basis: RawDimension["basis"] = "opis"): RawDimension =>
  ({ score, why: "uzasadnienie", evidence, basis });
const all = (score: number): Record<RadarKey, RawDimension> =>
  Object.fromEntries(RADAR_KEYS.map((k) => [k, dim(score)])) as Record<RadarKey, RawDimension>;
const ctx = (over: Partial<Parameters<typeof applyRules>[1]> = {}) =>
  ({ stage: "dziala", innovationKind: "edukacyjna", trl: null, cardText: TEXT, ...over });

describe("radar: cytaty", () => {
  test("cytat z linii klasyfikacji (etap, TRL, ochrona) też jest dowodem z karty", () => {
    assert.ok(quoteInCard("Etap: Działa", TEXT));
    assert.ok(quoteInCard("TRL 7: prototyp przetestowany w rzeczywistych warunkach pracy", TEXT));
    assert.ok(quoteInCard("Ochrona IP: Otwarta licencja", TEXT));
  });

  test("cytat z karty przechodzi mimo różnic w wielkości liter, cudzysłowach i odstępach", () => {
    assert.ok(quoteInCard("dwie inne  szkoły zbudowały „kopię”", TEXT));
    assert.ok(quoteInCard("Szkoły zawodowe nie mają sprzętu … aut elektrycznych.", TEXT));
  });

  test("drobna różnica w odmianie dłuższego cytatu przechodzi", () => {
    assert.ok(quoteInCard("Szkoły zawodowe nie mają sprzętu do nauki naprawy aut elektrycznych", TEXT));
    assert.ok(!quoteInCard("Szkoły nie mają pieniędzy na naprawy", TEXT));
  });

  test("parafraza i za krótki cytat nie przechodzą", () => {
    assert.ok(!quoteInCard("Trzy szkoły skopiowały rozwiązanie", TEXT));
    assert.ok(!quoteInCard("", TEXT));
    assert.ok(!quoteInCard("ab", TEXT));
  });

  test("ocena z cytatem spoza karty liczy się jak brak danych (najwyżej noDataMax)", () => {
    const out = applyRules({ ...all(4), nowosc: dim(5, "Nikt w Polsce tego nie robi") }, ctx());
    assert.equal(out.nowosc.basis, "brak_danych");
    assert.equal(out.nowosc.evidence, null);
    assert.equal(out.nowosc.score, RADAR.noDataMax);
    assert.equal(out.nowosc.rules.length, 2);
    assert.equal(out.wplyw.score, 4);
    assert.deepEqual(out.wplyw.rules, []);
  });

  test("brak danych od modelu też ogranicza ocenę", () => {
    const out = applyRules({ ...all(3), komercjalizacja: dim(4, "", "brak_danych") }, ctx());
    assert.equal(out.komercjalizacja.score, RADAR.noDataMax);
  });

  test("brakujący wymiar w odpowiedzi modelu = 0 i brak danych", () => {
    const raw: Partial<Record<RadarKey, RawDimension>> = all(3);
    delete raw.wplyw;
    const out = applyRules(raw, ctx());
    assert.equal(out.wplyw.score, 0);
    assert.equal(out.wplyw.basis, "brak_danych");
  });
});

describe("radar: limity dojrzałości i przeniesienie", () => {
  test("etap ogranicza dojrzałość", () => {
    assert.equal(applyRules(all(5), ctx({ stage: "pomysl" })).dojrzalosc.score, RADAR.maturityCap.pomysl);
    assert.equal(applyRules(all(5), ctx({ stage: "pilotaz" })).dojrzalosc.score, RADAR.maturityCap.pilotaz);
    assert.equal(applyRules(all(5), ctx({ stage: "dziala" })).dojrzalosc.score, 5);
  });

  test("TRL ogranicza dojrzałość tylko innowacji technologicznej", () => {
    const tech = applyRules(all(5), ctx({ stage: "dziala", innovationKind: "technologiczna", trl: 4 }));
    assert.equal(tech.dojrzalosc.score, RADAR.trlMaturityCap["4"]);
    assert.match(tech.dojrzalosc.rules[0], /TRL 4/);
    assert.equal(applyRules(all(5), ctx({ innovationKind: "edukacyjna", trl: 4 })).dojrzalosc.score, 5);
    assert.deepEqual(maturityCap({ stage: "pilotaz", innovationKind: "technologiczna", trl: 2 }).cap, RADAR.trlMaturityCap["2"]);
  });

  test("przeniesiona ⇒ skalowalność co najmniej próg, także po regule braku danych", () => {
    const out = applyRules({ ...all(3), skalowalnosc: dim(1, "", "brak_danych") }, ctx({ stage: "przeniesiona" }));
    assert.equal(out.skalowalnosc.score, RADAR.transferredMinScalability);
    assert.equal(applyRules({ ...all(3), skalowalnosc: dim(1) }, ctx({ stage: "dziala" })).skalowalnosc.score, 1);
  });

  test("oceny spoza 0–5 są przycinane", () => {
    assert.equal(applyRules(all(9), ctx()).wplyw.score, 5);
    assert.equal(applyRules(all(-2), ctx()).wplyw.score, 0);
  });
});

describe("radar: sygnał i wagi", () => {
  test("wagi zależą od typu innowacji, nieznany typ = domyślne", () => {
    assert.equal(weightsKey("technologiczna"), "technologiczna");
    assert.equal(weightsKey(null), "domyslne");
    assert.equal(weightsKey("cos-innego"), "domyslne");
  });

  test("sygnał: same piątki = 100, same zera = 0, w każdym zestawie wag", () => {
    const five = Object.fromEntries(RADAR_KEYS.map((k) => [k, { score: 5 }])) as Record<RadarKey, { score: number }>;
    const zero = Object.fromEntries(RADAR_KEYS.map((k) => [k, { score: 0 }])) as Record<RadarKey, { score: number }>;
    for (const kind of [...Object.keys(RADAR.weights), null]) {
      assert.equal(radarSignal(five, kind), 100);
      assert.equal(radarSignal(zero, kind), 0);
    }
  });

  test("ta sama ocena daje inny sygnał dla technologicznej i społecznej", () => {
    const dims = { nowosc: { score: 5 }, wplyw: { score: 1 }, dojrzalosc: { score: 3 }, skalowalnosc: { score: 2 }, komercjalizacja: { score: 5 } };
    const tech = radarSignal(dims, "technologiczna");
    const social = radarSignal(dims, "spoleczna");
    assert.ok(tech > social, `${tech} > ${social}`);
    // ręczne przeliczenie dla technologicznej
    const w = RADAR.weights.technologiczna;
    assert.equal(tech, Math.round(100 * (w.nowosc * 1 + w.wplyw * 0.2 + w.dojrzalosc * 0.6 + w.skalowalnosc * 0.4 + w.komercjalizacja * 1)));
  });

  test("pewność = część wymiarów opartych na opisie", () => {
    const out = applyRules({ ...all(3), nowosc: dim(3, "", "brak_danych"), wplyw: dim(3, "", "brak_danych") }, ctx());
    assert.equal(radarConfidence(out), 0.6);
  });

  test("buildAssessment zapisuje wersję metodologii, zestaw wag i sygnał po regułach", () => {
    const a = buildAssessment(all(5), ctx({ stage: "pomysl", innovationKind: "technologiczna", trl: 2 }),
      { strengths: ["s"], risks: ["r"], model: "test", assessedAt: "2026-11-21T10:00:00Z" });
    assert.equal(a.methodology, RADAR.methodologyVersion);
    assert.equal(a.weights, "technologiczna");
    assert.equal(a.dimensions.dojrzalosc.score, Math.min(RADAR.maturityCap.pomysl, RADAR.trlMaturityCap["2"]));
    assert.equal(a.signal, radarSignal(a.dimensions, "technologiczna"));
    assert.ok(a.signal < 100);
  });

  test("readAssessment: stara ocena (inne klucze) = null, nowa przechodzi", () => {
    assert.equal(readAssessment(null), null);
    assert.equal(readAssessment({ dimensions: { przenaszalnosc: { score: 3 } } }), null);
    const a = buildAssessment(all(3), ctx(), { strengths: [], risks: [], model: "seed", assessedAt: "2026-11-21T10:00:00Z" });
    assert.deepEqual(readAssessment(JSON.parse(JSON.stringify(a))), a);
  });
});

describe("radar: dane demo liczone tak samo jak w aplikacji", () => {
  type DemoInitiative = { slug: string; stage: string; innovation_kind: string; trl: number | null; signal: number; radar: unknown };
  const demo = JSON.parse(readFileSync("data/out/demo.json", "utf8")) as { initiatives: DemoInitiative[] };

  test("każda ocena seeda ma nowe wymiary, sygnał z wag dla typu i spełnia reguły", () => {
    for (const i of demo.initiatives) {
      const a = readAssessment(i.radar);
      assert.ok(a, `${i.slug}: ocena w nowym formacie`);
      assert.equal(a.methodology, RADAR.methodologyVersion, i.slug);
      assert.equal(a.weights, weightsKey(i.innovation_kind), i.slug);
      assert.equal(radarSignal(a.dimensions, i.innovation_kind), i.signal, `${i.slug}: sygnał`);
      assert.equal(a.signal, i.signal, i.slug);
      const { cap } = maturityCap({ stage: i.stage, innovationKind: i.innovation_kind, trl: i.trl });
      assert.ok(a.dimensions.dojrzalosc.score <= cap, `${i.slug}: dojrzałość ${a.dimensions.dojrzalosc.score} > ${cap}`);
      if (i.stage === "przeniesiona") assert.ok(a.dimensions.skalowalnosc.score >= RADAR.transferredMinScalability, `${i.slug}: skalowalność`);
      for (const k of RADAR_KEYS) {
        if (a.dimensions[k].basis === "brak_danych") assert.ok(a.dimensions[k].score <= RADAR.noDataMax, `${i.slug}: ${k}`);
      }
    }
  });
});
