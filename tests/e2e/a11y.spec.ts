import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// README §9: axe na kluczowych ekranach ścieżki mieszkańca (Zasobnik — w knowledge-a11y.spec.ts).
const PAGES = [
  ["strona główna", "/"],
  ["Opisz problem", "/opisz"],
  ["Zgłoś pomysł", "/pomysl"],
  ["Sprawdź status", "/status"],
  ["status — nieznany kod", "/status/XXXX-0000"],
  ["Jak to wdrożyć u nas?", "/wdrozenie"],
  ["Zapytaj eksperta", "/zapytaj"],
  ["API dla integracji", "/api-docs"],
] as const;

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")})`);
}

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

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

// WCAG 1.4.4: tekst powiększony do 200% (jak w ustawieniach przeglądarki) nie rozjeżdża układu.
test("tekst 200%: brak przewijania w poziomie", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const [, url] of PAGES) {
    await page.goto(url);
    await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
    expect(await horizontalOverflow(page), url).toBeLessThanOrEqual(0);
  }
});

test("widoczny fokus na każdym elemencie osiągalnym klawiaturą", async ({ page }) => {
  for (const [, url] of PAGES) {
    await page.goto(url);
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        // nextjs-portal to nakładka deweloperska `next dev` — za nią nie ma już treści strony.
        if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null;
        const s = getComputedStyle(el);
        const visible = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
        return { visible, label: `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 40)}"` };
      });
      if (!focused) break;
      expect(focused.visible, `${url}: ${focused.label}`).toBe(true);
    }
  }
});

test('Czytaj na głos czyta treść strony po polsku i zatrzymuje się po drugim kliknięciu', async ({ page }) => {
  // Atrapa syntezy mowy: w przeglądarce testowej nie ma głosów, a sprawdzamy tylko, co zostało wysłane do czytania.
  await page.addInitScript(() => {
    const spoken: { text: string; lang: string }[] = [];
    Object.assign(window, { __spoken: spoken });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: (u: SpeechSynthesisUtterance) => spoken.push({ text: u.text, lang: u.lang }),
        cancel: () => {},
        getVoices: () => [],
      },
    });
  });
  await page.goto("/opisz");
  const button = page.getByRole("button", { name: "Czytaj na głos" });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");

  const spoken = await page.evaluate(() => (window as unknown as { __spoken: { text: string; lang: string }[] }).__spoken);
  expect(spoken.length).toBeGreaterThan(0);
  expect(spoken.every((u) => u.lang === "pl-PL" && u.text.length <= 200)).toBe(true);
  expect(spoken.map((u) => u.text).join(" ")).toContain("Opisz problem");

  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
});

test('GminaField: anulacja wyboru odsunięciem kursora (WCAG 2.5.2)', async ({ page }) => {
  // Test na /opisz, która renderuje GminaField bez Supabase.
  await page.goto("/opisz");
  const gminaInput = page.locator("input").filter({ has: page.locator('input[aria-controls*="gmina"]') }).first();
  await gminaInput.click();
  await gminaInput.type("Boch");

  // Czekaj, aż lista się otworzy.
  const optionList = page.locator("ul[role='listbox']");
  await expect(optionList).toBeVisible({ timeout: 2000 });

  // Weź pierwszą opcję (powinna być Bochnia lub podobna).
  const firstOption = optionList.locator("li[role='option']").first();
  const optionText = await firstOption.textContent();
  expect(optionText).toContain("Boch");

  // Bounding box dla drażenia myszy.
  const box = await firstOption.boundingBox();
  expect(box).not.toBeNull();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;

  // Symuluj: mousedown na opcji, move poza nią, mouseup. Wybór powinien się NIE wykonać.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 500, cy); // Przesuń daleko od opcji.
  await page.mouse.up();

  // Pole powinno wciąż zawierać "Boch", a nie pełną nazwę gminy.
  const inputValue = await gminaInput.inputValue();
  expect(inputValue).toBe("Boch");

  // Zwykły click powinien wybrać opcję.
  await firstOption.click();
  const valueAfterClick = await gminaInput.inputValue();
  expect(valueAfterClick).toContain("Boch");
  expect(valueAfterClick.length).toBeGreaterThan("Boch".length); // Pełna nazwa.
});
