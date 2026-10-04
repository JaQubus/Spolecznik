import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  Innovation, InnovationsQuery, summarizeTests, toInnovation, toSummary, WEBHOOK_EVENTS, type InnovationDetailRow,
} from "../../lib/api/contract.ts";
import { buildOpenApi } from "../../lib/api/openapi.ts";

/** Pola, które nie mogą trafić do publicznego API (dane osobowe, treści zgłoszeń, klucze). */
const SENSITIVE = ["raw_text", "rawText", "contact_email", "contactEmail", "author_id", "authorId", "tester_id", "testerId",
  "tester_org", "testerOrg", "feedback", "suggestions", "access_key", "accessKey", "secret", "published"];

/** Nazwy wszystkich właściwości w schematach JSON (rekurencyjnie). */
function propertyNames(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((n) => propertyNames(n, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "properties" && v && typeof v === "object") Object.keys(v).forEach((p) => out.add(p));
      propertyNames(v, out);
    }
  }
  return out;
}

const ROW: InnovationDetailRow = {
  id: "5b0c8f2e-1d3a-4c6b-9e7f-2a1b3c4d5e6f", slug: "kamienica", title: "Kamienica", corpus: "biblioteka",
  category: null, innovation_type: "usluga", areas: ["seniorzy"], target_groups: null, cross_topics: [],
  solution: "Opis", etr_summary: null, tests_count: 2, avg_rating: "4.333", synthetic: true,
  updated_at: "2026-10-04T10:00:00+00:00", problem: null, beneficiaries: null, who_can_use: null, evidence: null,
  how_to_use: null, components: null, source_url: null, pdf_url: null, video_url: null, license_url: null,
};

describe("specyfikacja OpenAPI", () => {
  const spec = buildOpenApi();

  test("opisuje endpointy v1 i webhooki", () => {
    assert.equal(spec.openapi, "3.1.0");
    assert.deepEqual(Object.keys(spec.paths).sort(), ["/api/v1/innowacje", "/api/v1/innowacje/{slug}", "/api/v1/openapi.json"]);
    assert.deepEqual(Object.keys(spec.webhooks).sort(), [...WEBHOOK_EVENTS].sort());
  });

  test("każdy $ref wskazuje istniejący schemat", () => {
    const refs = JSON.stringify(spec).match(/#\/components\/schemas\/\w+/g) ?? [];
    for (const r of new Set(refs)) assert.ok(r.split("/").at(-1)! in spec.components.schemas, r);
  });

  test("parametry listy pochodzą ze schematu zapytania", () => {
    const params = spec.paths["/api/v1/innowacje"].get.parameters.map((p) => p.name);
    assert.deepEqual(params, Object.keys(InnovationsQuery.shape));
  });

  test("schematy nie mają pól wrażliwych", () => {
    const names = propertyNames(spec.components.schemas);
    for (const field of SENSITIVE) assert.ok(!names.has(field), field);
  });
});

describe("mapowanie wierszy", () => {
  test("odpowiedź ma tylko pola z kontraktu i przechodzi jego walidację", () => {
    const withExtra = { ...ROW, raw_text: "tajne", published: false, author_id: "x" };
    const testedIn = summarizeTests(
      [{ teryt: "1201011", status: "zakonczony" }, { teryt: "1201011", status: "planowany" }, { teryt: null, status: "planowany" }],
      new Map([["1201011", { nazwa: "Bochnia", powiat: "bocheński" }]]),
    );
    const out = toInnovation(withExtra, testedIn, "https://spolecznik.example");
    assert.deepEqual(Object.keys(out).sort(), Object.keys(Innovation.shape).sort());
    Innovation.parse(out);
    assert.equal(out.avgRating, 4.3);
    assert.deepEqual(out.targetGroups, []);
    assert.deepEqual(out.testedIn, [{ teryt: "1201011", gmina: "Bochnia", powiat: "bocheński", planned: 1, completed: 1 }]);
  });

  test("link prowadzi do karty z właściwego korpusu", () => {
    assert.equal(toSummary(ROW, "https://s.example").url, "https://s.example/biblioteka/innowacja/kamienica");
    assert.equal(toSummary({ ...ROW, corpus: "pipeline", slug: null }, "https://s.example").url, `https://s.example/biblioteka/${ROW.id}`);
  });

  test("teryt przyjmuje gminę i powiat z Małopolski", () => {
    for (const ok of ["1201011", "1261"]) assert.ok(InnovationsQuery.safeParse({ teryt: ok }).success, ok);
    for (const bad of ["0201011", "12010", "abc"]) assert.ok(!InnovationsQuery.safeParse({ teryt: bad }).success, bad);
  });

  test("limit ma domyślną wartość i górną granicę", () => {
    assert.deepEqual(InnovationsQuery.parse({}), { limit: 50, offset: 0 });
    assert.equal(InnovationsQuery.parse({ limit: "10", offset: "20" }).offset, 20);
    assert.ok(!InnovationsQuery.safeParse({ limit: "500" }).success);
  });
});
