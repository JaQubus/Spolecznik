import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function loginAs(page: Page, role: "administrator ROPS" | "mieszkaniec", next = "") {
  await page.goto(`/logowanie${next && `?dalej=${encodeURIComponent(next)}`}`);
  await page.getByRole("button", { name: `Wejdź jako ${role}` }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/logowanie"));
}

test("ścieżka demo w 3 kliknięciach: Zasobnik → Seniorzy → karta innowacji z historią i filmem", async ({ page }) => {
  await page.goto("/biblioteka");
  await page.getByRole("link", { name: "Seniorzy", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Seniorzy" })).toBeVisible();
  for (const h of ["Małopolska w liczbach", "Innowacje, które na to odpowiadają", "Materiały do nauki"]) {
    await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
  }
  await expect(page.getByText(/^Źródło:/).first()).toBeVisible();

  await page.getByRole("link", { name: "Senior CUDER" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Senior CUDER" })).toBeVisible();
  for (const step of ["Jaki problem rozwiązuje", "Na czym polega rozwiązanie", "Skąd wiemy, że działa", "Jak skorzystać i kto może to wdrożyć"]) {
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(step) })).toBeVisible();
  }
  // Film ładuje się dopiero po kliknięciu, z youtube-nocookie i atrybutem title.
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: /^Odtwórz film: Senior CUDER/ }).click();
  const frame = page.locator("iframe");
  await expect(frame).toHaveAttribute("src", /youtube-nocookie\.com\/embed\//);
  await expect(frame).toHaveAttribute("title", /Senior CUDER/);
});

test("„samotność starszych osób na wsi” zwraca obszar Seniorzy i innowacje dla seniorów", async ({ page }) => {
  await page.goto("/biblioteka");
  await page.getByLabel("O czym chcesz się dowiedzieć?").fill("samotność starszych osób na wsi");
  await page.getByRole("button", { name: "Szukaj" }).click();
  await expect(page.getByRole("status").filter({ hasText: "znaleźliśmy" })).toBeVisible();
  const areas = page.getByRole("region", { name: "Obszary" });
  await expect(areas.getByRole("link", { name: "Seniorzy" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Innowacje" }).getByRole("link", { name: "Mobilne centrum pomocy dla osób starszych" })).toBeVisible();
});

test("filtry Biblioteki: dla kogo + tylko z filmem, licznik ogłaszany w role=status", async ({ page }) => {
  await page.goto("/biblioteka?tab=library");
  await page.getByLabel("Dla kogo").selectOption("seniorzy");
  await page.getByRole("checkbox", { name: "Tylko z filmem" }).check();
  await page.getByRole("button", { name: "Pokaż wyniki" }).click();
  await expect(page).toHaveURL(/dla=seniorzy/);
  await expect(page.getByRole("status").filter({ hasText: /Znaleziono \d+ innowac/ })).toBeVisible();
});

test("materiały: link mówi, co pobieram — typ, rozmiar i język", async ({ page }) => {
  await page.goto("/biblioteka?tab=materials");
  await expect(page.getByRole("link", { name: /^Pobierz: Kanwa Innowacji Społecznych .*\(PDF, 7,7 MB, po polsku\)$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Pobierz: Połącz kropki/ })).toBeVisible();
});

test("trendy niedostępne dla mieszkańca (sprawdzane na serwerze)", async ({ page }) => {
  await loginAs(page, "mieszkaniec");
  const res = await page.goto("/panel/trendy");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Zgłoszenia według powiatu")).toHaveCount(0);
  expect((await page.request.get("/panel/trendy/eksport")).status()).toBe(403);
  expect((await page.goto("/panel/wiedza"))?.status()).toBe(404);
});

test("niezalogowany trafia na logowanie", async ({ page }) => {
  await page.goto("/panel/trendy");
  await expect(page).toHaveURL(/\/logowanie\?dalej=/);
});

test("admin: trendy z tabelą i eksport CSV, bez naruszeń axe", async ({ page }) => {
  await loginAs(page, "administrator ROPS", "/panel/trendy");
  await expect(page.getByRole("heading", { level: 1, name: "Trendy potrzeb" })).toBeVisible();
  await expect(page.getByRole("table", { name: /Liczba zgłoszeń według obszaru/ })).toBeVisible();
  const csv = await page.request.get("/panel/trendy/eksport?okres=month");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});

test("admin dodaje innowację, po chwili znajduje ją w wyszukiwarce, potem usuwa", async ({ page }) => {
  const title = `Testowa herbatka sąsiedzka ${Date.now()}`;
  await loginAs(page, "administrator ROPS", "/panel/wiedza");
  await page.getByRole("link", { name: "Dodaj innowację" }).click();

  // Pusty formularz: podsumowanie błędów dostaje fokus.
  await page.getByRole("button", { name: "Zapisz innowację" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "żeby zapisać" })).toBeFocused();

  await page.getByLabel(/^Nazwa/).fill(title);
  await page.getByRole("checkbox", { name: "Dla seniorów" }).check();
  await page.getByLabel(/^1\. Jaki problem rozwiązuje/).fill("Samotność starszych osób, które rzadko wychodzą z domu.");
  await page.getByLabel(/^2\. Na czym polega rozwiązanie/).fill("Wolontariusze raz w tygodniu odwiedzają seniorów z herbatą.");
  await page.getByLabel(/^4\. Kto może skorzystać/).fill("Ośrodki pomocy społecznej i koła gospodyń wiejskich.");
  await page.getByRole("button", { name: "Zapisz innowację" }).click();
  await expect(page.getByText("Zapisano. Innowacja będzie widoczna w wyszukiwarce za chwilę.")).toBeVisible();

  await expect(async () => {
    await page.goto(`/biblioteka?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole("link", { name: title })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });

  await page.goto("/panel/wiedza?rodzaj=innowacja");
  await page.getByRole("link", { name: `Edytuj: ${title}` }).click();
  await page.getByRole("button", { name: "Usuń innowację" }).click();
  await expect(page.getByText("Rekord został usunięty.")).toBeVisible();
});

test("Kondycja Małopolski: gminy i powiaty, kategorie, top 5, karta po kliknięciu, bez naruszeń axe", async ({ page }) => {
  await page.goto("/biblioteka/kondycja");
  const map = page.getByRole("group", { name: /^Mapa gmin:/ });
  await expect(map.locator("a[data-id]")).toHaveCount(183);

  // Kategoria bez danych dla gmin prowadzi na powiaty.
  await page.getByRole("link", { name: /^Placówki i kadra \(tylko powiaty\)$/ }).click();
  await expect(page.getByRole("group", { name: /^Mapa powiatów:/ }).getByRole("link")).toHaveCount(22);
  await expect(page.getByRole("link", { name: /^Placówki i kadra \(\d+\)$/ })).toHaveAttribute("aria-current", "true");

  // Powrót na gminy z tym samym wskaźnikiem: komunikat, że jest tylko dla powiatów.
  await page.getByRole("link", { name: /^Gminy \(183\)/ }).click();
  await expect(page.getByText("Tego wskaźnika nie ma dla gmin")).toBeVisible();

  // Kategoria + „Co pokazać”; pod mapą piątka z najwyższą i z najniższą wartością.
  await page.getByRole("link", { name: /^Ludność \(\d+\)$/ }).click();
  await page.getByLabel("Co pokazać").selectOption({ label: "Przyrost naturalny" });
  await expect(page.getByRole("heading", { level: 2, name: "Przyrost naturalny" })).toBeVisible();
  await expect(page.getByRole("region", { name: "5 gmin z najwyższą wartością" }).locator("tbody tr")).toHaveCount(5);
  await expect(page.getByRole("region", { name: "5 gmin z najniższą wartością" }).locator("tbody tr")).toHaveCount(5);
  await expect(page.getByText("Dane w tabeli")).toHaveCount(0);

  // Klawiatura: wyszukiwarka bez polskich znaków → karta gminy z fokusem na nagłówku.
  const search = page.getByRole("combobox", { name: "Znajdź gminę" });
  await search.fill("zakop");
  await page.getByRole("option", { name: /Zakopane/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Zakopane" })).toBeFocused();
  await expect(page).toHaveURL(/id=1217011/);

  // Z karty gminy do jej powiatu.
  await page.getByRole("link", { name: /^Więcej danych: powiat tatrzański/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "powiat tatrzański" })).toBeFocused();

  const { violations } = await new AxeBuilder({ page }).include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2)}`)).toEqual([]);
});
