import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  CROSS, CROSS_KEYS, DOMAIN_KEYS, DOMAINS, INSTITUTION_KEYS, INSTITUTION_TYPES, RADAR, RADAR_KEYS, signalLevel, STAGE_KEYS,
  STAGES,
} from "../../lib/taxonomy.ts";

describe("taxonomy", () => {
  test("krotki kluczy zgadzają się z config/taxonomy.json (ta sama kolejność)", () => {
    assert.deepEqual([...DOMAIN_KEYS], Object.keys(DOMAINS));
    assert.deepEqual([...INSTITUTION_KEYS], Object.keys(INSTITUTION_TYPES));
    assert.deepEqual([...STAGE_KEYS], Object.keys(STAGES));
    assert.deepEqual([...CROSS_KEYS], Object.keys(CROSS));
    assert.deepEqual([...RADAR_KEYS], Object.keys(RADAR.dimensions));
    assert.deepEqual([...RADAR_KEYS].sort(), Object.keys(RADAR.weights).sort());
    assert.deepEqual([...STAGE_KEYS].sort(), Object.keys(RADAR.maturityCap).sort());
  });

  test("slugi są unikalne w każdym słowniku", () => {
    for (const dict of [DOMAINS, INSTITUTION_TYPES, STAGES, CROSS]) {
      const slugs = Object.values(dict).map((e) => e.slug);
      assert.equal(new Set(slugs).size, slugs.length);
    }
  });

  test("wagi radaru sumują się do 1, progi idą od najwyższego", () => {
    const sum = Object.values(RADAR.weights).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `suma wag: ${sum}`);
    const mins = RADAR.levels.map((l) => l.min);
    assert.deepEqual(mins, [...mins].sort((a, b) => b - a));
    assert.equal(mins.at(-1), 0);
  });

  test("signalLevel", () => {
    assert.equal(signalLevel(100).key, "silny");
    assert.equal(signalLevel(70).key, "silny");
    assert.equal(signalLevel(69).key, "obiecujacy");
    assert.equal(signalLevel(0).key, "do_rozwiniecia");
  });

  test("seed danych demo używa tylko kluczy ze słowników", () => {
    const templates = JSON.parse(readFileSync("data/templates/initiatives.json", "utf8")) as {
      archetypes: { key: string; domains: string[]; institution_type: string; stages: string[]; cross: string[]; radar: Record<string, unknown> }[];
    };
    for (const a of templates.archetypes) {
      for (const d of a.domains) assert.ok(d in DOMAINS, `${a.key}: dziedzina ${d}`);
      for (const s of a.stages) assert.ok(s in STAGES, `${a.key}: etap ${s}`);
      for (const c of a.cross) assert.ok(c in CROSS, `${a.key}: temat ${c}`);
      assert.ok(a.institution_type in INSTITUTION_TYPES, `${a.key}: typ ${a.institution_type}`);
      assert.deepEqual(Object.keys(a.radar).sort(), [...RADAR_KEYS].sort(), `${a.key}: wymiary radaru`);
    }
  });
});
