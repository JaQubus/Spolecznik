import { expect, test } from "@playwright/test";
import { region } from "../../lib/brand";
import { axe, headingLevels, horizontalOverflow } from "./a11y";

// Axe bez błędów na kluczowych ekranach bazy wiedzy (WCAG 2.1 A i AA).
const PAGES = [
  ["Wiedza", "/wiedza"],
  ["wyniki wyszukiwania", "/wiedza?q=samotno%C5%9B%C4%87%20starszych%20os%C3%B3b"],
  ["strona dziedziny", "/wiedza/dziedzina/uslugi-spoleczne"],
  ["karta rozwiązania", "/rozwiazania/senior-cuder"],
  ["zakładka Materiały", "/wiedza?tab=materialy"],
  ["zakładka Rozwiązania", "/wiedza?tab=rozwiazania"],
  [`mapa kondycji ${region.genitive}`, "/mapa/kondycja"],
] as const;

for (const [name, url] of PAGES) {
  test(`axe: ${name} — bez naruszeń WCAG 2.1 AA`, async ({ page }) => {
    await page.goto(url);
    expect(await axe(page)).toEqual([]);
  });

  test(`axe: ${name} — wysoki kontrast`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("a11y-contrast", "1"));
    await page.goto(url);
    await expect(page.locator("html")).toHaveClass(/a11y-contrast/);
    expect(await axe(page)).toEqual([]);
  });
}

test("szerokość 320 px: brak przewijania w poziomie", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const [, url] of PAGES) {
    await page.goto(url);
    expect(await horizontalOverflow(page), url).toBeLessThanOrEqual(0);
  }
});

test("jeden h1 i nagłówki bez przeskoków", async ({ page }) => {
  for (const [, url] of PAGES) {
    await page.goto(url);
    const levels = await headingLevels(page);
    expect(levels.filter((l) => l === 1), url).toHaveLength(1);
    levels.forEach((l, i) => i > 0 && expect(l - levels[i - 1], `${url}: h${levels[i - 1]} → h${l}`).toBeLessThanOrEqual(1));
  }
});
