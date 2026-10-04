import { defineConfig } from "@playwright/test";

// Makiety UX/UI (#84): zrzuty wszystkich modułów w 390 px i 1440 px do docs/makiety/.
// Nie buduje aplikacji — korzysta z działającego serwera:
//   bun run makiety                                          (lokalnie, http://localhost:3000, z Panelem)
//   E2E_BASE_URL=https://spolecznik.vercel.app bun run makiety   (produkcja; Panel tylko z logowaniem testowym)
// Ekrany z odpowiedzią AI dostają odpowiedź podstawioną w skrypcie — skrypt nigdy nie woła Groq.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/makiety",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: [["list"]],
  use: { baseURL, locale: "pl-PL", colorScheme: "light", deviceScaleFactor: 1, trace: "off" },
  projects: [
    { name: "390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
