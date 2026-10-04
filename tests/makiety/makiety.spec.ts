import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import * as ai from "./fixtures";

// Makiety UX/UI (#84): kluczowe ekrany 7 modułów w 390 px i 1440 px → docs/makiety/<ekran>-<szerokość>.jpg.
// Kolejność i opis ekranów: docs/makiety.md. Uruchomienie: bun run makiety (szczegóły w playwright.makiety.config.ts).
// Skrypt tylko czyta stronę: nie wysyła formularzy, a odpowiedzi AI (/api/intake, /api/match, /api/middleman,
// /api/assistant) podstawia z fixtures.ts — Groq nie jest wołany.

const OUT = path.join(process.cwd(), "docs", "makiety");
/** Długie strony przycinamy — w makiecie liczy się początek przepływu. */
const MAX_HEIGHT = { phone: 2600, desktop: 1800 };

type Role = "admin" | "ekspert";
type Screen = {
  id: string;
  /** Adres albo funkcja, która sama dochodzi do ekranu (np. przez listę w Panelu). */
  open: string | ((page: Page) => Promise<void>);
  login?: Role;
  /** Kroki po wczytaniu strony: wypełnienie pól, kliknięcie z podstawioną odpowiedzią AI. */
  act?: (page: Page) => Promise<void>;
};

const LOGIN_BUTTON: Record<Role, string> = { admin: "Wejdź jako administrator ROPS", ekspert: "Wejdź jako ekspert" };

/** Logowanie testowe (lib/auth.ts). Na produkcji zwykle wyłączone — wtedy ekran jest pomijany. */
async function tryLogin(page: Page, role: Role): Promise<boolean> {
  await page.goto("/logowanie");
  const button = page.getByRole("button", { name: LOGIN_BUTTON[role] });
  if (!(await button.isVisible())) return false;
  await button.click();
  await page.waitForURL((u) => !u.pathname.startsWith("/logowanie"));
  return true;
}

const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Podstawia odpowiedź endpointu AI; inne żądania idą normalnie. */
async function fakeAi(page: Page, endpoint: string, body: unknown, status = 200) {
  await page.route(`**/api/${endpoint}`, (route) => route.fulfill(json(body, status)));
}

async function describeProblem(page: Page) {
  await page.getByLabel("Na czym polega problem?").fill(ai.DEMO_TEXT);
  await page.getByRole("button", { name: "Znajdź rozwiązania" }).click();
}

/** Pierwszy link z listy w Panelu (zgłoszenie, pomysł) — bez niego ekran szczegółów jest pomijany. */
function firstFromPanel(list: string, prefix: string) {
  return async (page: Page) => {
    await page.goto(list);
    const link = page.locator(`main a[href^="${prefix}"]`).first();
    test.skip((await link.count()) === 0, `Brak pozycji na liście ${list}`);
    await link.click();
    await page.waitForURL((u) => u.pathname.startsWith(prefix));
  };
}

const SCREENS: Screen[] = [
  // I. Dopasuj — Opisz problem
  { id: "01-start", open: "/" },
  { id: "02-opisz", open: "/opisz", act: (p) => p.getByLabel("Na czym polega problem?").fill(ai.DEMO_TEXT) },
  {
    id: "03-dopytanie",
    open: "/opisz",
    act: async (p) => {
      await fakeAi(p, "intake", ai.intakeFollowUp);
      await describeProblem(p);
      await expect(p.getByLabel(ai.intakeFollowUp.card.followUp)).toBeVisible();
    },
  },
  {
    id: "04-wyniki",
    open: "/opisz",
    act: async (p) => {
      await fakeAi(p, "intake", ai.intakeClear);
      await fakeAi(p, "match", ai.matchFound);
      await describeProblem(p);
      await expect(p.getByRole("heading", { name: "Znaleźliśmy 3 rozwiązania" })).toBeFocused();
    },
  },
  {
    id: "05-luka",
    open: "/opisz",
    act: async (p) => {
      await fakeAi(p, "intake", ai.intakeClear);
      await fakeAi(p, "match", ai.matchGap);
      await describeProblem(p);
      await expect(p.getByRole("heading", { name: "Nie znaleźliśmy jeszcze gotowego rozwiązania" })).toBeVisible();
    },
  },
  {
    id: "06-ai-zajete",
    open: "/opisz",
    act: async (p) => {
      await fakeAi(p, "intake", ai.aiBusy, 503);
      await describeProblem(p);
      await expect(p.getByRole("alert").filter({ hasText: "Za dużo zapytań do AI naraz" })).toBeFocused();
    },
  },
  { id: "07-status", open: "/status" },
  {
    id: "08-status-os-czasu",
    open: async (page) => {
      let code = process.env.MAKIETY_KOD;
      if (!code && (await tryLogin(page, "admin"))) {
        await page.goto("/panel?status=wszystkie");
        code = (await page.locator("main").innerText()).match(/SPL-[2-9A-HJ-NP-Z]{4}/)?.[0];
        await page.context().clearCookies(); // oś czasu tak, jak widzi ją autor bez konta
      }
      test.skip(!code, "Brak kodu zgłoszenia: ustaw MAKIETY_KOD albo uruchom z logowaniem testowym");
      await page.goto(`/status/${code}`);
    },
  },

  // VII. Wdrożenie — Jak to wdrożyć u nas?
  { id: "10-wdrozenie", open: "/wdrozenie?innowacja=senior-cuder" },
  {
    id: "11-karta-wdrozeniowa",
    open: "/wdrozenie?innowacja=senior-cuder",
    act: async (p) => {
      await fakeAi(p, "middleman", ai.implementation);
      await p.getByLabel("Twoja gmina").fill("Kamienica");
      await p.keyboard.press("Escape");
      await p.getByRole("button", { name: "Przygotuj kartę wdrożeniową" }).click();
      await expect(p.getByRole("heading", { name: "Senior CUDER w gminie Kamienica" })).toBeFocused();
    },
  },

  // IV. Próba — Przetestuj rozwiązanie
  { id: "20-przetestuj", open: "/przetestuj?innowacja=senior-cuder" },
  {
    id: "21-ocena",
    open: "/przetestuj?innowacja=senior-cuder",
    act: (p) => p.getByRole("radio", { name: "Test już się odbył — chcę go ocenić" }).check(),
  },

  // II. Wiedza — Biblioteka i wiedza
  { id: "30-biblioteka", open: "/biblioteka" },
  { id: "31-obszar", open: "/biblioteka/obszar/seniorzy" },
  { id: "32-innowacja", open: "/biblioteka/innowacja/senior-cuder" },
  { id: "33-filtry", open: "/biblioteka?tab=library&dla=seniorzy" },
  { id: "34-kondycja", open: "/biblioteka/kondycja" },
  { id: "35-ucz-sie", open: "/biblioteka/ucz-sie" },

  // III. Pracownia — Zgłoś pomysł i wniosek
  { id: "40-pomysl", open: "/pomysl" },
  {
    id: "41-asystent",
    open: "/pomysl",
    act: async (p) => {
      await fakeAi(p, "assistant", ai.assistant);
      await p.getByLabel("Krótki opis").fill("Sąsiedzki dowóz seniorów z przysiółków do klubu seniora");
      await p.getByRole("button", { name: "Sprawdź, czy to coś nowego" }).click();
      await expect(p.getByText("Podobne rzeczy, które już są")).toBeVisible();
    },
  },
  { id: "42-wniosek", open: "/wniosek" },

  // V. Rozmowy — Zapytaj eksperta
  { id: "50-zapytaj", open: "/zapytaj" },
  { id: "51-ekspert", open: "/ekspert", login: "ekspert" },

  // VI. Panel ROPS
  { id: "60-logowanie", open: "/logowanie" },
  { id: "61-panel", open: "/panel", login: "admin" },
  { id: "62-zgloszenie", open: firstFromPanel("/panel?status=wszystkie", "/panel/zgloszenia/"), login: "admin" },
  { id: "63-pomysly", open: "/panel/pomysly", login: "admin" },
  { id: "64-nabory", open: "/panel/nabory", login: "admin" },
  { id: "65-trendy", open: "/panel/trendy", login: "admin" },
  { id: "66-wiedza", open: "/panel/wiedza", login: "admin" },
];

async function capture(page: Page, file: string) {
  // Bez znaczka narzędzi deweloperskich Next.js w trybie dev.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  const { width } = page.viewportSize()!;
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const max = width < 800 ? MAX_HEIGHT.phone : MAX_HEIGHT.desktop;
  await page.screenshot({
    path: path.join(OUT, file),
    type: "jpeg",
    quality: 70,
    fullPage: true,
    clip: { x: 0, y: 0, width, height: Math.min(height, max) },
    animations: "disabled",
    caret: "hide",
  });
}

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

for (const screen of SCREENS) {
  test(screen.id, async ({ page }, info) => {
    if (screen.login) {
      test.skip(!(await tryLogin(page, screen.login)), "Logowanie testowe wyłączone na tym serwerze (TEST_LOGIN)");
    }
    if (typeof screen.open === "string") {
      const res = await page.goto(screen.open);
      test.skip(res?.status() === 404, `${screen.open}: 404 na tym serwerze`);
    } else {
      await screen.open(page);
    }
    await screen.act?.(page);
    await capture(page, `${screen.id}-${info.project.name}.jpg`);
  });
}
