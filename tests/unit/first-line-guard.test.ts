import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { asksAboutOwnCase } from "../../lib/first-line-guard.ts";

describe("pytania o własną sprawę idą do ROPS bez AI", () => {
  for (const text of [
    "Jaki jest status mojego zgłoszenia?",
    "Na jakim etapie jest sprawa?",
    "Kiedy dostanę odpowiedź?",
    "Kiedy ktoś się odezwie?",
    "Jak długo trzeba czekać?",
    "Ile jeszcze dni to potrwa?",
    "Czy jest już decyzja w sprawie SPL-AB12?",
    "Czy moje zgłoszenie zostało rozpatrzone?",
    "Co z moim pomysłem? Czekam od tygodnia",
  ]) {
    test(text, () => assert.equal(asksAboutOwnCase(text), true));
  }
});

describe("pytania o wiedzę może obsłużyć asystent", () => {
  for (const text of [
    "Ile jest domów pomocy społecznej w Małopolsce?",
    "Co robić, kiedy senior jest samotny i nie wychodzi z domu?",
    "Jakie są przykłady wsparcia opiekunów osób z niepełnosprawnością?",
    "Czy są w regionie kluby seniora?",
  ]) {
    test(text, () => assert.equal(asksAboutOwnCase(text), false));
  }
});
