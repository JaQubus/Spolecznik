import { expect, test, type Page } from "@playwright/test";
import { brand, org, region } from "../../lib/brand";
import { axe, headingLevels, horizontalOverflow } from "./a11y";

// Axe na kluczowych ekranach poza bazą wiedzy (ta ma knowledge-a11y.spec.ts). Tylko odczyt — nic nie wysyłamy,
// więc testy nie wołają LLM i nie zapisują danych.
const PUBLIC = [
  ["strona główna", "/"],
  ["Zgłoś inicjatywę", "/zglos"],
  ["Wskaż inicjatywę", "/wskaz"],
  ["Szukam rozwiązania", "/szukam"],
  ["Sprawdź status", "/status"],
  ["status: nieznany kod", `/status/${brand.statusPrefix}-ZZZZ`],
  ["Warsztat pomysłu", "/zglos/warsztat"],
  ["Przenieś do siebie", "/przenies"],
  ["Wypróbowaliśmy u nas", "/wyprobuj"],
  ["Rozmowy", "/rozmowy"],
  ["Inicjatywy", "/inicjatywy"],
  ["wniosek", "/wniosek"],
  [`Kondycja ${region.genitive}`, "/mapa/kondycja"],
  ["Ucz się", "/wiedza/ucz-sie"],
  ["logowanie", "/logowanie"],
  ["API dla integracji", "/api-docs"],
] as const;

const PANEL = [
  ["Panel: radar", "/panel"],
  ["Panel: programy", "/panel/programy"],
  ["Panel: adopcje", "/panel/adopcje"],
  ["Panel: przeniesienia", "/panel/przeniesienia"],
  ["Panel: trendy i popyt bez podaży", "/panel/trendy"],
  ["Panel: wiedza", "/panel/wiedza"],
] as const;

async function loginAsAdmin(page: Page) {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: `Wejdź jako administrator ${org.short}` }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/logowanie"));
}

async function checkHeadings(page: Page, url: string) {
  const levels = await headingLevels(page);
  expect(levels.filter((l) => l === 1), `${url}: jeden h1`).toHaveLength(1);
  levels.forEach((l, i) => i > 0 && expect(l - levels[i - 1], `${url}: h${levels[i - 1]} → h${l}`).toBeLessThanOrEqual(1));
}

function screens(list: readonly (readonly [string, string])[], before?: (page: Page) => Promise<void>) {
  for (const [name, url] of list) {
    test(`axe: ${name} — bez naruszeń WCAG 2.1 AA`, async ({ page }) => {
      await before?.(page);
      await page.goto(url);
      expect(await axe(page)).toEqual([]);
    });

    test(`axe: ${name} — wysoki kontrast`, async ({ page }) => {
      await before?.(page);
      await page.addInitScript(() => localStorage.setItem("a11y-contrast", "1"));
      await page.goto(url);
      await expect(page.locator("html")).toHaveClass(/a11y-contrast/);
      expect(await axe(page)).toEqual([]);
    });
  }

  test(`320 px bez przewijania w poziomie i nagłówki bez przeskoków (${list.length} ekranów)`, async ({ page }) => {
    await before?.(page);
    await page.setViewportSize({ width: 320, height: 800 });
    for (const [, url] of list) {
      await page.goto(url);
      expect(await horizontalOverflow(page), url).toBeLessThanOrEqual(0);
      await checkHeadings(page, url);
    }
  });
}

test.describe("ekrany publiczne", () => {
  screens(PUBLIC);

  test("menu na telefonie po rozwinięciu", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Dostępność" }).click();
    expect(await axe(page, "header")).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe(`panel ${org.short} (konto testowe admina)`, () => {
  screens(PANEL, loginAsAdmin);

  test("otwarty dzwonek powiadomień", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/panel");
    const bell = page.getByRole("button", { name: /^Powiadomienia/ });
    await bell.click();
    await expect(bell).toHaveAttribute("aria-expanded", "true");
    expect(await axe(page, "header")).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(bell).toHaveAttribute("aria-expanded", "false");
    await expect(bell).toBeFocused();
  });
});
