import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  Initiative, InitiativesQuery, toInitiative, toSummary, WEBHOOK_EVENTS, type InitiativeDetailRow,
} from "../../lib/api/contract.ts";
import { buildOpenApi } from "../../lib/api/openapi.ts";
import { region } from "../../lib/brand.ts";

/** Pola, które nie mogą trafić do publicznego API (dane osobowe, treści przed weryfikacją, klucze). */
const SENSITIVE = ["raw_text", "rawText", "contact_email", "contactEmail", "author_id", "authorId", "access_hash", "accessHash",
  "access_key", "accessKey", "secret", "published", "clarity", "followUps", "assigned_mentor", "signal_override"];

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

const ROW: InitiativeDetailRow = {
  id: "5b0c8f2e-1d3a-4c6b-9e7f-2a1b3c4d5e6f", slug: "robotyka", title: "Robotyka w małych szkołach",
  summary: "Jedna szkoła wozi zestawy robotów do sąsiednich.", domains: ["edukacja"], institution_type: "szkola_podstawowa",
  stage: "dziala", cross_topics: ["obszary_wiejskie"], county_teryt: region.countyExample.teryt, county: region.countyExample.name,
  municipality: region.municipalityExample.name, signal: 72, status: "featured", nominations_count: 2, adoptions_count: 3,
  avg_rating: "4.333", synthetic: true, created_at: "2026-10-04T10:00:00+00:00", updated_at: "2026-10-05T10:00:00+00:00",
  card: { problem: "Małe szkoły nie stać na sprzęt.", solution: "Wspólny zestaw.", effects: null, beneficiaries: "uczniowie" },
};

describe("specyfikacja OpenAPI", () => {
  const spec = buildOpenApi();

  test("opisuje endpointy v1 i webhooki", () => {
    assert.equal(spec.openapi, "3.1.0");
    assert.deepEqual(Object.keys(spec.paths).sort(), ["/api/v1/inicjatywy", "/api/v1/inicjatywy/{slug}", "/api/v1/openapi.json"]);
    assert.deepEqual(Object.keys(spec.webhooks).sort(), [...WEBHOOK_EVENTS].sort());
  });

  test("każdy $ref wskazuje istniejący schemat", () => {
    const refs = JSON.stringify(spec).match(/#\/components\/schemas\/\w+/g) ?? [];
    for (const r of new Set(refs)) assert.ok(r.split("/").at(-1)! in spec.components.schemas, r);
  });

  test("parametry listy pochodzą ze schematu zapytania", () => {
    const params = spec.paths["/api/v1/inicjatywy"].get.parameters.map((p) => p.name);
    assert.deepEqual(params, Object.keys(InitiativesQuery.shape));
  });

  test("schematy nie mają pól wrażliwych", () => {
    const names = propertyNames(spec.components.schemas);
    for (const field of SENSITIVE) assert.ok(!names.has(field), field);
  });
});

describe("mapowanie wierszy", () => {
  test("odpowiedź ma tylko pola z kontraktu i przechodzi jego walidację", () => {
    const withExtra = { ...ROW, raw_text: "tajne", published: false, author_id: "x", contact_email: "a@b.pl" };
    const out = toInitiative(withExtra, "https://radar.example");
    assert.deepEqual(Object.keys(out).sort(), Object.keys(Initiative.shape).sort());
    Initiative.parse(out);
    assert.equal(out.avgRating, 4.3);
    assert.equal(out.problem, "Małe szkoły nie stać na sprzęt.");
    assert.equal(out.effects, null);
  });

  test("karta bez pól daje null zamiast wyjątku", () => {
    const out = toInitiative({ ...ROW, card: null }, "https://radar.example");
    assert.equal(out.solution, null);
  });

  test("link prowadzi do strony inicjatywy", () => {
    assert.equal(toSummary(ROW, "https://r.example").url, "https://r.example/inicjatywy/robotyka");
    assert.equal(toSummary({ ...ROW, slug: null }, "https://r.example").url, `https://r.example/inicjatywy/${ROW.id}`);
    assert.equal(toSummary({ ...ROW, slug: "dom/ogród" }, "https://r.example").url, "https://r.example/inicjatywy/dom%2Fogr%C3%B3d");
  });

  test(`teryt przyjmuje tylko powiat z ${region.genitive}`, () => {
    const { countyExample: c, cityCountyExample: m } = region;
    for (const ok of [c.teryt, m.teryt]) assert.ok(InitiativesQuery.safeParse({ teryt: ok }).success, ok);
    for (const bad of [`${c.teryt}011`, "0001", `${c.teryt}0`, "abc"]) assert.ok(!InitiativesQuery.safeParse({ teryt: bad }).success, bad);
  });

  test("filtry przyjmują tylko klucze z taksonomii", () => {
    assert.ok(InitiativesQuery.safeParse({ dziedzina: "edukacja", instytucja: "uczelnia", etap: "pilotaz" }).success);
    assert.ok(!InitiativesQuery.safeParse({ dziedzina: "seniorzy" }).success);
  });

  test("limit ma domyślną wartość i górną granicę", () => {
    assert.deepEqual(InitiativesQuery.parse({}), { limit: 50, offset: 0 });
    assert.equal(InitiativesQuery.parse({ limit: "10", offset: "20" }).offset, 20);
    assert.ok(!InitiativesQuery.safeParse({ limit: "500" }).success);
  });
});
