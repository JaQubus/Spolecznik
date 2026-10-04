import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { z } from "zod";
import { IdeaPoster } from "../../lib/schemas.ts";

const poster = {
  headline: "Wspólne dojazdy do przychodni",
  oneLiner: "Sąsiedzi z autem podwożą seniorów do lekarza, a gmina koordynuje terminy.",
  journey: [
    { who: "Senior", action: "dzwoni do GOPS i zgłasza wizytę u lekarza", icon: "phone" },
    { who: "Koordynator", action: "dobiera kierowcę z listy sąsiadów", icon: "user-group" },
    { who: "Kierowca", action: "podwozi seniora i odwozi go do domu", icon: "truck" },
  ],
  benefits: ["Senior nie odwołuje wizyt", "Sąsiedzi się poznają"],
  needs: [{ kind: "ludzie", text: "5–10 kierowców-wolontariuszy" }],
  object: null,
};

describe("IdeaPoster", () => {
  test("przyjmuje poprawny plakat", () => {
    assert.ok(IdeaPoster.safeParse(poster).success);
  });

  test("nieznana ikona i rodzaj potrzeby dostają wartości zastępcze", () => {
    const parsed = IdeaPoster.parse({
      ...poster,
      journey: poster.journey.map((s) => ({ ...s, icon: "rakieta" })),
      needs: [{ kind: "kasa", text: "10 tys. zł" }],
    });
    assert.equal(parsed.journey[0].icon, "light-bulb");
    assert.equal(parsed.needs[0].kind, "inne");
  });

  test("schemat przedmiotu: nieznany kształt to prostokąt", () => {
    const parsed = IdeaPoster.parse({
      ...poster,
      object: { name: "Skrzynka", shape: "trojkat", description: "Drewniana skrzynka", parts: [{ name: "Półka", purpose: "" }] },
    });
    assert.equal(parsed.object?.shape, "prostokat");
  });

  test("za długi tekst przycina na granicy słowa, pusty odrzuca", () => {
    const parsed = IdeaPoster.parse({ ...poster, headline: "Wspólne dojazdy seniorów ".repeat(10) });
    assert.ok(parsed.headline.length <= 70);
    assert.match(parsed.headline, /(Wspólne|dojazdy|seniorów)…$/);
    assert.equal(IdeaPoster.safeParse({ ...poster, headline: "  " }).success, false);
  });

  test("odrzuca plakat z mniej niż trzema krokami", () => {
    assert.equal(IdeaPoster.safeParse({ ...poster, journey: poster.journey.slice(0, 2) }).success, false);
  });

  test("da się zamienić na JSON Schema dla promptu Groq", () => {
    const schema = JSON.stringify(z.toJSONSchema(IdeaPoster));
    assert.match(schema, /light-bulb/);
    assert.match(schema, /okragly/);
  });
});
