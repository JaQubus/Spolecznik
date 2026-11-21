import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  CREATOR_ROLE_KEYS, CREATOR_ROLES, CROSS, CROSS_KEYS, DOMAIN_KEYS, DOMAINS, INNOVATION_KIND_KEYS, INNOVATION_KINDS,
  INSTITUTION_KEYS, INSTITUTION_TYPES, IP_STATUS_KEYS, IP_STATUSES, PARTNER_KIND_KEYS, PARTNER_KINDS, PARTNER_SUPPORT,
  PARTNER_SUPPORT_KEYS, RADAR, RADAR_KEYS, SECTOR_KEYS, SECTORS, signalLevel, STAGE_KEYS, STAGES, stageForTrl, TRL_LEVELS,
  TRL_MAX, TRL_MIN, trlLabel,
} from "../../lib/taxonomy.ts";
import { InitiativeCard, normalizeCard } from "../../lib/schemas.ts";

describe("taxonomy", () => {
  test("krotki kluczy zgadzają się z config/taxonomy.json (ta sama kolejność)", () => {
    assert.deepEqual([...DOMAIN_KEYS], Object.keys(DOMAINS));
    assert.deepEqual([...INSTITUTION_KEYS], Object.keys(INSTITUTION_TYPES));
    assert.deepEqual([...STAGE_KEYS], Object.keys(STAGES));
    assert.deepEqual([...CROSS_KEYS], Object.keys(CROSS));
    assert.deepEqual([...RADAR_KEYS], Object.keys(RADAR.dimensions));
    assert.deepEqual([...INNOVATION_KIND_KEYS, "domyslne"].sort(), Object.keys(RADAR.weights).sort());
    for (const [kind, w] of Object.entries(RADAR.weights)) assert.deepEqual(Object.keys(w).sort(), [...RADAR_KEYS].sort(), `wagi ${kind}`);
    assert.deepEqual([...STAGE_KEYS].sort(), Object.keys(RADAR.maturityCap).sort());
    assert.deepEqual(Object.keys(RADAR.trlMaturityCap).map(Number), Array.from({ length: TRL_MAX - TRL_MIN + 1 }, (_, i) => TRL_MIN + i));
    assert.deepEqual([...INNOVATION_KIND_KEYS], Object.keys(INNOVATION_KINDS));
    assert.deepEqual([...SECTOR_KEYS], Object.keys(SECTORS));
    assert.deepEqual([...IP_STATUS_KEYS], Object.keys(IP_STATUSES));
    assert.deepEqual([...CREATOR_ROLE_KEYS], Object.keys(CREATOR_ROLES));
    assert.deepEqual([...PARTNER_KIND_KEYS], Object.keys(PARTNER_KINDS));
    assert.deepEqual([...PARTNER_SUPPORT_KEYS], Object.keys(PARTNER_SUPPORT));
    assert.deepEqual(Object.keys(TRL_LEVELS).map(Number), Array.from({ length: TRL_MAX - TRL_MIN + 1 }, (_, i) => TRL_MIN + i));
  });

  test("slugi są unikalne w każdym słowniku", () => {
    for (const dict of [DOMAINS, INSTITUTION_TYPES, STAGES, CROSS, INNOVATION_KINDS, SECTORS, IP_STATUSES, CREATOR_ROLES, PARTNER_KINDS, PARTNER_SUPPORT]) {
      const slugs = Object.values(dict).map((e) => e.slug);
      assert.equal(new Set(slugs).size, slugs.length);
    }
  });

  test("każdy zestaw wag radaru sumuje się do 1, progi idą od najwyższego", () => {
    for (const [kind, w] of Object.entries(RADAR.weights)) {
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `suma wag ${kind}: ${sum}`);
    }
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

  test("stageForTrl: każdy poziom TRL ma etap, przedziały rosną", () => {
    assert.equal(stageForTrl(1), "pomysl");
    assert.equal(stageForTrl(3), "pomysl");
    assert.equal(stageForTrl(4), "pilotaz");
    assert.equal(stageForTrl(6), "pilotaz");
    assert.equal(stageForTrl(7), "dziala");
    assert.equal(stageForTrl(9), "dziala");
    const order = [...STAGE_KEYS];
    for (let t = TRL_MIN; t < TRL_MAX; t++) assert.ok(order.indexOf(stageForTrl(t)) <= order.indexOf(stageForTrl(t + 1)), `TRL ${t}`);
    assert.equal(trlLabel(4), "TRL 4: model sprawdzony w laboratorium");
  });

  test("seed danych demo używa tylko kluczy ze słowników", () => {
    type Archetype = {
      key: string; domains: string[]; institution_type: string; stages: string[]; cross: string[]; radar: Record<string, unknown>;
      innovation_kind: string; sectors: string[]; trl?: number; ip_status?: string; creators: { role: string; label: string }[];
    };
    type Partner = { slug: string; kind: string; sectors: string[]; domains: string[]; support: string[]; stages: string[]; trl_min: number | null; trl_max: number | null };
    const templates = JSON.parse(readFileSync("data/templates/initiatives.json", "utf8")) as { archetypes: Archetype[]; partners: Partner[] };
    for (const a of templates.archetypes) {
      for (const d of a.domains) assert.ok(d in DOMAINS, `${a.key}: dziedzina ${d}`);
      for (const s of a.stages) assert.ok(s in STAGES, `${a.key}: etap ${s}`);
      for (const c of a.cross) assert.ok(c in CROSS, `${a.key}: temat ${c}`);
      assert.ok(a.institution_type in INSTITUTION_TYPES, `${a.key}: typ ${a.institution_type}`);
      assert.deepEqual(Object.keys(a.radar).sort(), [...RADAR_KEYS].sort(), `${a.key}: wymiary radaru`);
      assert.ok(a.innovation_kind in INNOVATION_KINDS, `${a.key}: typ innowacji ${a.innovation_kind}`);
      assert.ok(a.sectors.length >= 1 && a.sectors.every((s) => s in SECTORS), `${a.key}: sektory`);
      assert.ok(a.creators.every((c) => c.role in CREATOR_ROLES && c.label), `${a.key}: twórcy`);
      if (a.ip_status) assert.ok(a.ip_status in IP_STATUSES, `${a.key}: IP ${a.ip_status}`);
      assert.equal(a.trl !== undefined, a.innovation_kind === "technologiczna", `${a.key}: TRL tylko dla technologicznej`);
    }
    const tech = templates.archetypes.filter((a) => a.innovation_kind === "technologiczna" && a.sectors.some((s) => s !== "inne"));
    assert.ok(tech.length >= 10, `archetypy technologiczne z sektorem PCI: ${tech.length}`);

    assert.ok(templates.partners.length >= 25, `partnerzy: ${templates.partners.length}`);
    assert.equal(new Set(templates.partners.map((p) => p.slug)).size, templates.partners.length, "slugi partnerów");
    for (const p of templates.partners) {
      assert.ok(p.kind in PARTNER_KINDS, `${p.slug}: rodzaj ${p.kind}`);
      assert.ok(p.sectors.every((s) => s in SECTORS) && p.domains.every((d) => d in DOMAINS), `${p.slug}: sektory i dziedziny`);
      assert.ok(p.support.length > 0 && p.support.every((s) => s in PARTNER_SUPPORT), `${p.slug}: formy wsparcia`);
      assert.ok(p.stages.every((s) => s in STAGES), `${p.slug}: etapy`);
      assert.ok(p.trl_min == null || p.trl_max == null || p.trl_min <= p.trl_max, `${p.slug}: przedział TRL`);
      assert.ok(p.trl_min != null || p.stages.length > 0, `${p.slug}: TRL albo etapy, inaczej dopasowanie nie ma czego porównać`);
    }
  });
});

describe("karta inicjatywy", () => {
  const card: InitiativeCard = {
    title: "Stanowisko do testów silników", summary: "Uczniowie zbudowali stanowisko.", problem: "Brak sprzętu.", solution: "Własne stanowisko.",
    effects: null, beneficiaries: null, domains: ["edukacja"], institutionType: "szkola_ponadpodstawowa", stage: "dziala", cross: [],
    innovationKind: "technologiczna", sectors: ["motoryzacja"], trl: 7, ipStatus: "open", creatorRoles: ["uczen", "nauczyciel"],
    municipality: null, keywords: ["silnik", "technikum", "stanowisko"], clarity: 0.8, followUps: [],
  };

  test("schemat przyjmuje kartę z modelem PCI i odrzuca TRL spoza 1–9", () => {
    InitiativeCard.parse(card);
    assert.throws(() => InitiativeCard.parse({ ...card, trl: 10 }));
  });

  test("normalizeCard naprawia sektory i role zamiast odrzucać kartę", () => {
    assert.deepEqual(normalizeCard({ ...card, sectors: [] }).sectors, ["inne"]);
    assert.deepEqual(normalizeCard({ ...card, sectors: ["ict", "motoryzacja", "jakosc_zycia"] }).sectors, ["ict", "motoryzacja"]);
    assert.deepEqual(normalizeCard({ ...card, creatorRoles: ["uczen", "uczen", "nauczyciel", "student", "urzednik"] }).creatorRoles.length, 3);
  });

  test("normalizeCard zostawia TRL tylko innowacji technologicznej", () => {
    assert.equal(normalizeCard(card).trl, 7);
    assert.equal(normalizeCard({ ...card, innovationKind: "edukacyjna" }).trl, null);
  });

  test("normalizeCard: „inne” tylko samodzielnie", () => {
    assert.deepEqual(normalizeCard({ ...card, sectors: ["lotnictwo_kosmos", "inne"] }).sectors, ["lotnictwo_kosmos"]);
    assert.deepEqual(normalizeCard({ ...card, sectors: ["inne"] }).sectors, ["inne"]);
  });
});
