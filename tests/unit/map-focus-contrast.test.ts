import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Luminancja względna wg WCAG 2.x: dla każdego kanału RGB
function channel(c: number): number {
  const normalized = c / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = channel(parseInt(clean.slice(0, 2), 16));
  const g = channel(parseInt(clean.slice(2, 4), 16));
  const b = channel(parseInt(clean.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Odczytaj tokens CSS z globals.css
const globalsPath = join(import.meta.dirname, "../../app/globals.css");
const css = readFileSync(globalsPath, "utf-8");

// Wyciągnij wartości --map-1..5, --surface, --ink, --focus z :root
// Znajdujemy :root blok - szukamy od :root do pierwszego }
const rootStart = css.indexOf(":root");
assert(rootStart !== -1, "nie znalazł :root");
let braceCount = 0;
let rootEnd = rootStart;
for (let i = rootStart; i < css.length; i++) {
  if (css[i] === "{") braceCount++;
  if (css[i] === "}") {
    braceCount--;
    if (braceCount === 0) {
      rootEnd = i + 1;
      break;
    }
  }
}
const rootBlock = css.substring(rootStart, rootEnd);

const parseToken = (name: string, text: string): string | null => {
  const match = text.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
};

const map1Light = parseToken("map-1", rootBlock);
const map2Light = parseToken("map-2", rootBlock);
const map3Light = parseToken("map-3", rootBlock);
const map4Light = parseToken("map-4", rootBlock);
const map5Light = parseToken("map-5", rootBlock);
const surfaceLight = parseToken("surface", rootBlock);
const focusLight = parseToken("focus", rootBlock);

assert(map1Light && map2Light && map3Light && map4Light && map5Light && surfaceLight && focusLight, "brakuje tokenów w :root");

// Tryb a11y-contrast: szukaj --focus i --map-1..5
const a11yStart = css.indexOf("html.a11y-contrast");
assert(a11yStart !== -1, "nie znalazł html.a11y-contrast");
let a11yBraceCount = 0;
let a11yEnd = a11yStart;
for (let i = a11yStart; i < css.length; i++) {
  if (css[i] === "{") a11yBraceCount++;
  if (css[i] === "}") {
    a11yBraceCount--;
    if (a11yBraceCount === 0) {
      a11yEnd = i + 1;
      break;
    }
  }
}
const a11yBlock = css.substring(a11yStart, a11yEnd);
const focusA11y = parseToken("focus", a11yBlock) || focusLight; // jeśli nie ma override'u, bierz z :root
const map1A11y = parseToken("map-1", a11yBlock) || map1Light;
const map2A11y = parseToken("map-2", a11yBlock) || map2Light;
const map3A11y = parseToken("map-3", a11yBlock) || map3Light;
const map4A11y = parseToken("map-4", a11yBlock) || map4Light;
const map5A11y = parseToken("map-5", a11yBlock) || map5Light;
const surfaceA11y = parseToken("surface", a11yBlock) || surfaceLight;

describe("WCAG 2.4.7 + 1.4.11: kontrast obrysu fokusu mapy (--focus) vs wypełnień", () => {
  test("tryb jasny: --focus vs każdy --map-N, wymagane ≥3:1 dla przynajmniej jednego z --focus lub --surface", () => {
    const maps = [
      { n: 1, color: map1Light },
      { n: 2, color: map2Light },
      { n: 3, color: map3Light },
      { n: 4, color: map4Light },
      { n: 5, color: map5Light },
    ];

    for (const { n, color } of maps) {
      const focusContrast = contrastRatio(focusLight, color);
      const surfaceContrast = contrastRatio(surfaceLight, color);
      const maxContrast = Math.max(focusContrast, surfaceContrast);

      assert(
        maxContrast >= 3,
        `klasa ${n} (#${color}): max(focus=${focusContrast.toFixed(2)}, surface=${surfaceContrast.toFixed(2)}) = ${maxContrast.toFixed(2)} < 3:1`
      );
    }
  });

  test("tryb jasny: --focus vs --surface, wymagane ≥3:1", () => {
    const contrast = contrastRatio(focusLight, surfaceLight);
    assert(
      contrast >= 3,
      `focus vs surface: ${contrast.toFixed(2)} < 3:1`
    );
  });

  test("tryb wysokiego kontrastu: --focus vs każdy --map-N, wymagane ≥3:1 dla przynajmniej jednego z --focus lub --surface", () => {
    const maps = [
      { n: 1, color: map1A11y },
      { n: 2, color: map2A11y },
      { n: 3, color: map3A11y },
      { n: 4, color: map4A11y },
      { n: 5, color: map5A11y },
    ];

    for (const { n, color } of maps) {
      const focusContrast = contrastRatio(focusA11y, color);
      const surfaceContrast = contrastRatio(surfaceA11y, color);
      const maxContrast = Math.max(focusContrast, surfaceContrast);

      assert(
        maxContrast >= 3,
        `klasa ${n} (#${color}): max(focus=${focusContrast.toFixed(2)}, surface=${surfaceContrast.toFixed(2)}) = ${maxContrast.toFixed(2)} < 3:1`
      );
    }
  });

  test("tryb wysokiego kontrastu: --focus vs --surface, wymagane ≥3:1", () => {
    const contrast = contrastRatio(focusA11y, surfaceA11y);
    assert(
      contrast >= 3,
      `focus vs surface: ${contrast.toFixed(2)} < 3:1`
    );
  });
});
