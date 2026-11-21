import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { brand, region } from "../../lib/brand.ts";
import {
  ClaimRequest, InitiativeRequest, SOURCE_RECORD_KINDS, SOURCES, SourceClassification, type InitiativeCard,
} from "../../lib/schemas.ts";
import { keywordSimilarity, keywordStems, normalizeKeywords, pickDuplicate } from "../../lib/source-records.ts";

type Rec = {
  source: string; external_id: string; kind: string; title: string; abstract: string | null; institution: string | null;
  institution_type: string | null; teryt: string | null; license: string; keywords: string[]; synthetic: boolean;
};
const snapshot = (s: string) => `data/raw/sources/${s}.json`;
const records: Rec[] = SOURCES.filter((s) => existsSync(snapshot(s)))
  .flatMap((s) => (JSON.parse(readFileSync(snapshot(s), "utf8")) as { records: Rec[] }).records);

describe("sprawdzanie dublowania bez LLM", () => {
  test("normalizeKeywords: małe litery, bez pustych i powtórzeń", () => {
    assert.deepEqual(normalizeKeywords([" Kompozyt", "kompozyt", "", "Włókno węglowe "]), ["kompozyt", "włókno węglowe"]);
  });

  test("keywordSimilarity: rdzenie słów, odporne na formy i frazy z LLM", () => {
    assert.equal(keywordSimilarity(["włókno węglowy", "kompozyt"], ["kompozytu", "włókna węglowego"]), 1);
    assert.equal(keywordSimilarity(["monitoring"], ["monitorowanie"]), 1);
    assert.equal(keywordSimilarity(["wykrywanie_upadków"], ["wykrywanie upadku"]), 1);
    assert.equal(keywordSimilarity(["kompozyt", "dron"], ["kompozyt", "radar", "senior"]), 0.5);
    assert.equal(keywordSimilarity(["metoda", "system"], ["metoda"]), 0, "słowa ogólne niczego nie rozróżniają");
    assert.equal(keywordSimilarity([], ["x"]), 0);
    assert.deepEqual(keywordStems(["Kot", "kotwica"]), ["kotw"], "słowa krótsze niż 4 litery pomijamy");
  });

  test("pickDuplicate: zgłoszenie PL i odpowiednik EP to jedno rozwiązanie, inny temat nie", () => {
    const pl = ["kompozyt", "włókno węglowe", "recykling", "wspornik", "lotnictwo", "odpad produkcyjny"];
    const ep = ["kompozyt", "włókna węglowego", "recyklingu", "wsporniki", "przemysł lotniczy"];
    const radar = ["radar", "upadek", "senior", "czujnik"];
    assert.equal(pickDuplicate(ep, [{ initiativeId: "pl", keywords: pl }, { initiativeId: "r", keywords: radar }]), "pl");
    assert.equal(pickDuplicate(radar, [{ initiativeId: "pl", keywords: pl }]), null);
    assert.equal(pickDuplicate(["kompozyt"], [{ initiativeId: "pl", keywords: pl }]), null, "jedno wspólne słowo to za mało");
  });
});

describe("migawki źródeł (data/raw/sources)", () => {
  test("są rekordy z każdego źródła, w tym prawdziwe", () => {
    assert.deepEqual([...new Set(records.map((r) => r.source))].sort(), [...SOURCES].sort());
    assert.ok(records.some((r) => !r.synthetic), "co najmniej jedno źródło z prawdziwymi danymi");
  });

  test("wspólny format: identyfikator, rodzaj, tytuł, licencja; identyfikatory unikalne w źródle", () => {
    const keys = records.map((r) => `${r.source}:${r.external_id}`);
    assert.equal(new Set(keys).size, keys.length);
    for (const r of records) {
      assert.ok(r.external_id && r.title && r.license, `${r.source}:${r.external_id}`);
      assert.ok((SOURCE_RECORD_KINDS as readonly string[]).includes(r.kind), `${r.external_id}: rodzaj ${r.kind}`);
      assert.ok(r.keywords.every((k) => k === k.toLowerCase()), `${r.external_id}: słowa kluczowe małymi literami`);
    }
  });

  test("przykładowe rekordy są oznaczone i nie udają prawdziwych", () => {
    for (const r of records.filter((x) => x.synthetic)) {
      assert.ok(r.external_id.startsWith("PRZYKLAD-"), r.external_id);
      assert.ok(r.institution?.includes("(przykład)"), `${r.external_id}: instytucja bez „(przykład)”`);
    }
  });

  test("tylko instytucje publiczne z regionu", () => {
    for (const r of records) {
      assert.ok(!/fundacj|stowarzysz|association|sp\. z o\.o|s\.a\./i.test(r.institution ?? ""), `${r.external_id}: ${r.institution}`);
      assert.ok(r.teryt == null || r.teryt.startsWith(region.terytPrefix), `${r.external_id}: TERYT ${r.teryt}`);
      assert.ok(r.institution_type, `${r.external_id}: typ instytucji`);
    }
  });

  test("bez danych osobowych: brak pól z osobami i nazwisk z tytułem naukowym", () => {
    for (const r of records) {
      const raw = r as Record<string, unknown>;
      for (const f of ["inventors", "authors", "author", "contact", "email"]) assert.ok(!(f in raw), `${r.external_id}: pole ${f}`);
      const text = `${r.title} ${r.abstract ?? ""}`;
      assert.ok(!/(?:dr|prof\.|inż\.|mgr)\s+[A-ZŁŚŻŹĆŃÓ][a-ząćęłńóśźż]+\s+[A-ZŁŚŻŹĆŃÓ]/.test(text), `${r.external_id}: osoba w tekście`);
      assert.ok(!/Przykładow[ya] /.test(text), `${r.external_id}: nazwisko przykładowe nie zostało usunięte`);
      assert.ok(!/[\w.+-]+@[\w-]+\.\w/.test(text), `${r.external_id}: e-mail`);
    }
  });

  test("migawka zawiera przypadek demo 2: zgłoszenie uczelni z Rzeszowa i podobne rekordy w EPO i PBN", () => {
    const composite = (r: Rec) => r.keywords.includes("kompozyt") && r.keywords.includes("recykling");
    const uprp = records.find((r) => r.source === "uprp" && r.kind === "zgloszenie_patentowe" && composite(r));
    assert.ok(uprp?.institution?.startsWith("Politechnika Rzeszowska"));
    assert.ok(records.some((r) => r.source === "epo" && composite(r)));
    assert.ok(records.some((r) => r.source === "pbn" && composite(r)));
  });
});

describe("klasyfikator", () => {
  const cachePath = "data/raw/sources/classified.json";
  const cache = existsSync(cachePath) ? (JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, unknown>) : {};

  test("każdy wpis cache przechodzi walidację SourceClassification i reguły karty", () => {
    for (const [key, value] of Object.entries(cache)) {
      const c = SourceClassification.parse(value);
      if (!c.candidate) { assert.equal(c.card, null, key); continue; }
      assert.ok(c.card, key);
      assert.ok(c.card.trl == null || c.card.innovationKind === "technologiczna", `${key}: TRL tylko technologiczna`);
      assert.ok(!(c.card.sectors.length > 1 && c.card.sectors.includes("inne")), `${key}: „inne” tylko samodzielnie`);
      const kind = records.find((r) => `${r.source}:${r.external_id}` === key)?.kind;
      if (kind === "zgloszenie_patentowe") assert.equal(c.card.ipStatus, "zgloszenie", key);
      if (kind === "patent") assert.equal(c.card.ipStatus, "patent", key);
    }
  });

  test("zgłoszenia z formularza nie mogą udawać wykrytych", () => {
    const card = { title: "Abc", summary: "s", problem: "p", solution: "s", effects: null, beneficiaries: null, domains: ["nauka"],
      institutionType: null, stage: "pomysl", cross: [], innovationKind: "spoleczna", sectors: ["inne"], trl: null, ipStatus: null,
      creatorRoles: [], municipality: null, keywords: ["a", "b", "c"], clarity: 0.7, followUps: [] } satisfies InitiativeCard;
    assert.ok(InitiativeRequest.safeParse({ kind: "own", card, text: "opis" }).success);
    assert.ok(!InitiativeRequest.safeParse({ kind: "detected", card, text: "opis" }).success);
  });

  test("przejęcie wymaga potwierdzenia i poprawnego kodu", () => {
    const card = { title: "Wsporniki z kompozytu", summary: "s", problem: "p", solution: "s", effects: null, beneficiaries: null,
      stage: "pilotaz", innovationKind: "technologiczna", sectors: ["lotnictwo_kosmos"], trl: 4, ipStatus: "zgloszenie", creatorRoles: ["naukowiec"] };
    const code = brand.statusExample;
    assert.ok(ClaimRequest.safeParse({ code, card, confirm: true }).success);
    assert.ok(!ClaimRequest.safeParse({ code, card, confirm: false }).success);
    assert.ok(!ClaimRequest.safeParse({ code: "XYZ", card, confirm: true }).success);
  });
});
