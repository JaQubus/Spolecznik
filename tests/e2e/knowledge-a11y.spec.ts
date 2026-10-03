import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Kryterium akceptacji modułu II: axe bez błędów na kluczowych ekranach Zasobnika (WCAG 2.1 A i AA).
const PAGES = [
  ["Zasobnik", "/biblioteka"],
  ["wyniki wyszukiwania", "/biblioteka?q=samotno%C5%9B%C4%87%20starszych%20os%C3%B3b%20na%20wsi"],
  ["strona obszaru", "/biblioteka/obszar/seniorzy"],
  ["karta innowacji", "/biblioteka/innowacja/senior-cuder"],
  ["zakładka Materiały", "/biblioteka?tab=materials"],
  ["zakładka Wyzwania Małopolski", "/biblioteka?tab=challenges"],
] as const;

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")})`);
}

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
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});

test("jeden h1 i nagłówki bez przeskoków", async ({ page }) => {
  for (const [, url] of PAGES) {
    await page.goto(url);
    const levels = await page.$$eval("main h1, main h2, main h3, main h4", (hs) => hs.map((h) => Number(h.tagName[1])));
    expect(levels.filter((l) => l === 1), url).toHaveLength(1);
    levels.forEach((l, i) => i > 0 && expect(l - levels[i - 1], `${url}: h${levels[i - 1]} → h${l}`).toBeLessThanOrEqual(1));
  }
});
