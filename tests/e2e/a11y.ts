import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** Naruszenia WCAG 2.1 A i AA według axe, jako czytelne linie (pusta lista = brak błędów). */
export async function axe(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  return violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")})`);
}

/** Ile pikseli strona wystaje poza okno w poziomie (SC 1.4.10: przy 320 px ma być 0). */
export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** Poziomy nagłówków w <main>, w kolejności w dokumencie. */
export const headingLevels = (page: Page) =>
  page.$$eval("main h1, main h2, main h3, main h4", (hs) => hs.map((h) => Number(h.tagName[1])));
