import { defineConfig, devices } from "@playwright/test";

// Testy end-to-end i dostępności (axe). Domyślnie budują aplikację i uruchamiają ją na porcie 3100
// z logowaniem testowym. Działający serwer: E2E_BASE_URL=http://localhost:3000 pnpm test:e2e
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false, // testy panelu zapisują dane — po kolei
  reporter: [["list"]],
  use: { baseURL, locale: "pl-PL", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm start -p 3100",
        url: `${baseURL}/biblioteka`,
        reuseExistingServer: true,
        timeout: 300_000,
        env: { TEST_LOGIN: "1", TEST_LOGIN_SECRET: "sekret-tylko-do-testow-e2e" },
      },
});
