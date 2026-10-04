import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { FOCUS_MIN_SCORE, MIN_COHORT } from "../../lib/gmina-report/config.ts";
import { buildCohorts, median, profileFor, type ReportData } from "../../lib/gmina-report/score.ts";
import { allowedNumbers, checkSummary, numbersIn, templateSummary } from "../../lib/gmina-report/summary.ts";

const map = JSON.parse(readFileSync(new URL("../../public/mapa/malopolska.json", import.meta.url), "utf8"));
const data: ReportData = { gminy: map.layers.gminy, powiaty: map.layers.powiaty };
const cohorts = buildCohorts(data.gminy.units);

describe("grupy porównawcze", () => {
  test("każda gmina jest w dokładnie jednej grupie, a grupy mają co najmniej MIN_COHORT gmin", () => {
    const all = cohorts.flatMap((c) => c.members);
    assert.equal(all.length, data.gminy.units.length);
    assert.equal(new Set(all).size, all.length);
    for (const c of cohorts) assert.ok(c.members.length >= MIN_COHORT, `${c.key}: ${c.members.length}`);
  });

  test("grupa ma jeden typ gminy", () => {
    for (const c of cohorts) assert.ok(c.members.every((t) => ({ miejska: "1", wiejska: "2", "miejsko-wiejska": "3" })[c.type] === t[6]));
  });
});

describe("profil gminy", () => {
  test("nieznany TERYT daje null", () => {
    assert.equal(profileFor("9999999", data, cohorts), null);
  });

  test("percentyl potrzeby uwzględnia kierunek wskaźnika", () => {
    for (const u of data.gminy.units.slice(0, 40)) {
      const p = profileFor(u.id, data, cohorts)!;
      for (const a of p.areas) for (const i of a.indicators) {
        if (i.needPct == null || i.lowerPct == null || i.higherPct == null) continue;
        // need_up: dużo niższych wartości = duża potrzeba; need_down odwrotnie.
        if (i.lowerPct > 60 && i.direction === "need_up") assert.ok(i.needPct > 50, `${u.name} ${i.key}`);
        if (i.lowerPct > 60 && i.direction === "need_down") assert.ok(i.needPct < 50, `${u.name} ${i.key}`);
      }
    }
  });

  test("obszary do uwagi: najwyżej 3, tylko od progu, od największej potrzeby", () => {
    for (const u of data.gminy.units) {
      const p = profileFor(u.id, data, cohorts)!;
      assert.ok(p.focus.length <= 3);
      const scores = p.focus.map((f) => p.areas.find((a) => a.area === f)!.score!);
      assert.ok(scores.every((s) => s >= FOCUS_MIN_SCORE));
      assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
    }
  });

  test("gminy różnego typu mają różne obszary do uwagi", () => {
    const tops = new Set(data.gminy.units.map((u) => profileFor(u.id, data, cohorts)!.focus.join(",")));
    assert.ok(tops.size > 10, `tylko ${tops.size} różnych zestawów`);
  });

  test("dane powiatowe porównujemy z powiatami, nie z grupą gmin", () => {
    const p = profileFor(data.gminy.units[0].id, data, cohorts)!;
    const powiatRows = p.areas.flatMap((a) => a.indicators).filter((i) => i.level === "powiat");
    assert.ok(powiatRows.length > 0);
    for (const i of powiatRows) {
      assert.equal(i.cohortMedian, null);
      assert.equal(i.comparedWith, data.powiaty.units.length);
    }
  });

  test("mediana", () => {
    assert.equal(median([]), null);
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 2, 3]), 2.5);
  });
});

describe("podsumowanie", () => {
  const p = profileFor(data.gminy.units[0].id, data, cohorts)!;

  test("szablon przechodzi własną walidację", () => {
    for (const u of data.gminy.units) {
      const q = profileFor(u.id, data, cohorts)!;
      const r = checkSummary(templateSummary(q), allowedNumbers(q));
      assert.ok(r.ok, `${u.name}: ${r.reason} — ${templateSummary(q)}`);
    }
  });

  test("odrzuca liczbę spoza danych", () => {
    const r = checkSummary(`${p.name} ma 987654 mieszkańców, a potrzeby są tu typowe dla gmin podobnych.`, allowedNumbers(p));
    assert.equal(r.ok, false);
  });

  test("odrzuca słowa oceniające", () => {
    const r = checkSummary(`${p.name} to gmina problemowa, o czym świadczą wszystkie wskaźniki z danych GUS.`, allowedNumbers(p));
    assert.equal(r.ok, false);
  });

  test("odrzuca „średnią”, której w danych nie ma", () => {
    const r = checkSummary(`${p.name}: wynik przewyższa średnią w powiatach Małopolski, co wymaga uwagi w planowaniu działań.`, allowedNumbers(p));
    assert.equal(r.ok, false);
  });

  test("czyta liczby po polsku", () => {
    assert.deepEqual(numbersIn("mieszka 28 187 osób, 22,5% to seniorzy, rok 2024"), [
      { value: 28187, decimals: 0 }, { value: 22.5, decimals: 1 }, { value: 2024, decimals: 0 },
    ]);
  });
});
