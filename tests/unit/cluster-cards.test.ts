import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { clusterCards, keywordOverlap, type ClusterInput } from "../../lib/knowledge/cluster-cards.ts";

const need = (id: string, keywords: string[], teryt: string | null = null): ClusterInput => ({ id, teryt, keywords });

describe("clusterCards", () => {
  test("łączy zgłoszenia z dwoma wspólnymi rzadkimi słowami, pomija samotne", () => {
    const groups = clusterCards([
      need("a", ["udar", "rehabilitacja", "senior"], "1"),
      need("b", ["Udar", "rehabilitacja", "opieka domowa"], "2"),
      need("c", ["udar", "rehabilitacja", "wieś"], "2"),
      need("d", ["żłobek", "rodzic", "powrót do pracy"]),
      need("e", ["senior", "samotność", "klub seniora"]),
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].ids.toSorted(), ["a", "b", "c"]);
    assert.equal(groups[0].gminy, 2);
    assert.deepEqual(groups[0].keywords.slice(0, 2).toSorted(), ["rehabilitacja", "udar"]);
  });

  test("jedno wspólne słowo nie wystarcza", () => {
    const groups = clusterCards([
      need("a", ["senior", "samotność", "wieś"]),
      need("b", ["senior", "oszustwo", "telefon"]),
      need("c", ["senior", "udar", "rehabilitacja"]),
    ]);
    assert.equal(groups.length, 0);
  });

  test("nie łączy łańcuchem A–B–C, gdy A i C nie mają nic wspólnego", () => {
    const groups = clusterCards([
      need("a1", ["depresja", "kryzys", "psycholog"]),
      need("a2", ["depresja", "kryzys", "psycholog"]),
      need("ab", ["depresja", "kryzys", "transport", "autobus"]),
      need("b1", ["transport", "autobus", "lekarz"]),
      need("b2", ["transport", "autobus", "lekarz"]),
    ], 0.3, 2);
    for (const g of groups) {
      const ids = new Set(g.ids);
      assert.ok(!(ids.has("a1") && ids.has("b1")), `łańcuch w grupie ${g.ids.join(",")}`);
    }
  });

  test("podpis grupy nie zależy od kolejności zgłoszeń", () => {
    const needs = [
      need("a", ["udar", "rehabilitacja", "senior"]),
      need("b", ["udar", "rehabilitacja", "opieka domowa"]),
      need("c", ["udar", "rehabilitacja", "wieś"]),
    ];
    assert.equal(clusterCards(needs)[0].signature, clusterCards(needs.toReversed())[0].signature);
  });

  test("dane demonstracyjne: kilkanaście grup, każda inicjatywa najwyżej w jednej", () => {
    const { initiatives } = JSON.parse(readFileSync("data/out/demo.json", "utf8")) as {
      initiatives: { id: string; teryt: string | null; card: { keywords: string[] } }[];
    };
    const groups = clusterCards(initiatives.map((n) => need(n.id, n.card.keywords, n.teryt)));
    assert.ok(groups.length >= 5 && groups.length <= 45, `${groups.length} grup`);
    const ids = groups.flatMap((g) => g.ids);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(groups.map((g) => g.signature)).size, groups.length);
  });
});

test("keywordOverlap", () => {
  assert.equal(keywordOverlap(["a", "b", "c", "d"], ["A", "b", "c", "e"]), 3 / 5);
  assert.equal(keywordOverlap([], []), 0);
});
