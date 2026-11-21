import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { org, region } from "../../lib/brand";

const ADMIN = `administrator ${org.short}`;

async function loginAs(page: Page, role: string, next = "") {
  await page.goto(`/logowanie${next && `?dalej=${encodeURIComponent(next)}`}`);
  await page.getByRole("button", { name: `Wejdź jako ${role}` }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/logowanie"));
}

test("ścieżka demo w 3 kliknięciach: Wiedza → Usługi społeczne → karta rozwiązania z historią i filmem", async ({ page }) => {
  await page.goto("/wiedza");
  await page.getByRole("link", { name: "Usługi społeczne", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Usługi społeczne" })).toBeVisible();
  for (const h of ["Sprawdzone rozwiązania z Polski", "Materiały do nauki"]) {
    await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
  }

  await page.goto("/rozwiazania/senior-cuder");
  await expect(page.getByRole("heading", { level: 1, name: "Senior CUDER" })).toBeVisible();
  for (const step of ["Jaki problem rozwiązuje", "Na czym polega", "Co już dała", "Jak przenieść ją do siebie"]) {
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(step) })).toBeVisible();
  }
  // Film ładuje się dopiero po kliknięciu, z youtube-nocookie i atrybutem title.
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: /^Odtwórz film: Senior CUDER/ }).click();
  const frame = page.locator("iframe");
  await expect(frame).toHaveAttribute("src", /youtube-nocookie\.com\/embed\//);
  await expect(frame).toHaveAttribute("title", /Senior CUDER/);
});

test("„samotność starszych osób” zwraca rozwiązania dla seniorów", async ({ page }) => {
  await page.goto("/wiedza");
  await page.getByLabel("O czym chcesz się dowiedzieć?").fill("samotność starszych osób");
  await page.getByRole("button", { name: "Szukaj" }).click();
  await expect(page.getByRole("status").filter({ hasText: "znaleźliśmy" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sprawdzone rozwiązania" }).getByRole("link", { name: "Mobilne centrum pomocy dla osób starszych" })).toBeVisible();
});

test("rozwiązania: filtr dziedziny z adresu, licznik ogłaszany w role=status", async ({ page }) => {
  await page.goto("/wiedza");
  await page.getByRole("link", { name: "Usługi społeczne" }).first().click();
  await expect(page).toHaveURL(/dziedzina=uslugi_spoleczne/);
  await expect(page.getByRole("status").filter({ hasText: /Znaleziono \d+ rozwiąza/ })).toBeVisible();
});

test("materiały: link mówi, co pobieram — typ, rozmiar i język", async ({ page }) => {
  await page.goto("/wiedza?tab=materialy");
  await expect(page.getByRole("link", { name: /^Pobierz: Kanwa Innowacji Społecznych .*\(PDF, 7,7 MB, po polsku\)$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Pobierz: Połącz kropki/ })).toBeVisible();
});

test("trendy niedostępne dla autora (sprawdzane na serwerze)", async ({ page }) => {
  await loginAs(page, "autor");
  const res = await page.goto("/panel/trendy");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Inicjatywy według powiatu")).toHaveCount(0);
  expect((await page.request.get("/panel/trendy/eksport")).status()).toBe(403);
  expect((await page.goto("/panel/wiedza"))?.status()).toBe(404);
});

test("niezalogowany trafia na logowanie", async ({ page }) => {
  await page.goto("/panel/trendy");
  await expect(page).toHaveURL(/\/logowanie\?dalej=/);
});

test("admin: trendy z tabelą i eksport CSV, bez naruszeń axe", async ({ page }) => {
  await loginAs(page, ADMIN, "/panel/trendy");
  await expect(page.getByRole("heading", { level: 1, name: "Trendy" })).toBeVisible();
  await expect(page.getByRole("table", { name: /Liczba nowych inicjatyw według dziedziny/ })).toBeVisible();
  const csv = await page.request.get("/panel/trendy/eksport?okres=month");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});

test("admin dodaje rozwiązanie, po chwili znajduje je w wyszukiwarce, potem usuwa", async ({ page }) => {
  const title = `Testowa herbatka sąsiedzka ${Date.now()}`;
  await loginAs(page, ADMIN, "/panel/wiedza");
  await page.getByRole("link", { name: "Dodaj rozwiązanie" }).click();

  // Pusty formularz: podsumowanie błędów dostaje fokus.
  await page.getByRole("button", { name: "Zapisz rozwiązanie" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "żeby zapisać" })).toBeFocused();

  await page.getByLabel(/^Nazwa/).fill(title);
  await page.getByRole("checkbox", { name: "Usługi społeczne" }).check();
  await page.getByLabel(/^1\. Jaki problem rozwiązuje/).fill("Samotność starszych osób, które rzadko wychodzą z domu.");
  await page.getByLabel(/^2\. Na czym polega rozwiązanie/).fill("Wolontariusze raz w tygodniu odwiedzają seniorów z herbatą.");
  await page.getByLabel(/^4\. Kto może skorzystać/).fill("Ośrodki pomocy społecznej i koła gospodyń wiejskich.");
  await page.getByRole("button", { name: "Zapisz rozwiązanie" }).click();
  await expect(page.getByText("Zapisano. Rozwiązanie będzie widoczne w wyszukiwarce za chwilę.")).toBeVisible();

  await expect(async () => {
    await page.goto(`/wiedza?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole("link", { name: title })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });

  await page.goto("/panel/wiedza?rodzaj=rozwiazanie");
  await page.getByRole("link", { name: `Edytuj: ${title}` }).click();
  await page.getByRole("button", { name: "Usuń rozwiązanie" }).click();
  await expect(page.getByText("Rekord został usunięty.")).toBeVisible();
});

test(`Kondycja ${region.genitive}: gminy i powiaty, kategorie, top 5, karta po kliknięciu, bez naruszeń axe`, async ({ page }) => {
  await page.goto("/mapa/kondycja");
  const map = page.getByRole("group", { name: /^Mapa gmin:/ });
  await expect(map.locator("a[data-id]")).toHaveCount(region.expectedMunicipalities);

  // Przełącznik poziomów: powiaty i z powrotem gminy.
  await page.getByRole("link", { name: new RegExp(`^Powiaty \\(${region.expectedCounties}\\)`) }).click();
  await expect(page.getByRole("group", { name: /^Mapa powiatów:/ }).getByRole("link")).toHaveCount(region.expectedCounties);
  await page.getByRole("link", { name: new RegExp(`^Gminy \\(${region.expectedMunicipalities}\\)`) }).click();
  await expect(map.locator("a[data-id]")).toHaveCount(region.expectedMunicipalities);

  // Kategoria + „Co pokazać”; pod mapą piątka z najwyższą i z najniższą wartością.
  await page.getByRole("link", { name: /^Ludność \(\d+\)$/ }).click();
  await page.getByLabel("Co pokazać").selectOption({ label: "Przyrost naturalny" });
  await expect(page.getByRole("heading", { level: 2, name: "Przyrost naturalny" })).toBeVisible();
  await expect(page.getByRole("region", { name: "5 gmin z najwyższą wartością" }).locator("tbody tr")).toHaveCount(5);
  await expect(page.getByRole("region", { name: "5 gmin z najniższą wartością" }).locator("tbody tr")).toHaveCount(5);
  await expect(page.getByText("Dane w tabeli")).toHaveCount(0);

  // Klawiatura: wyszukiwarka bez polskich znaków → karta gminy z fokusem na nagłówku.
  const search = page.getByRole("combobox", { name: "Znajdź gminę" });
  const example = region.municipalityExample;
  await search.fill(example.search);
  await page.getByRole("option", { name: new RegExp(example.name) }).click();
  await expect(page.getByRole("heading", { level: 2, name: example.name })).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`id=${example.teryt}`));

  // Z karty gminy do jej powiatu.
  await page.getByRole("link", { name: new RegExp(`^Więcej danych: powiat ${example.county}`) }).click();
  await expect(page.getByRole("heading", { level: 2, name: `powiat ${example.county}` })).toBeFocused();

  const { violations } = await new AxeBuilder({ page }).include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2)}`)).toEqual([]);
});
