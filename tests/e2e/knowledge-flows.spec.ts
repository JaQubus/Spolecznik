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

test("mapa Małopolski: gminy i powiaty z prawdziwymi granicami, wybór z listy, tabela, bez naruszeń axe", async ({ page }) => {
  await page.goto("/biblioteka");
  const map = page.getByRole("region", { name: "Małopolska na mapie" });
  await map.scrollIntoViewIfNeeded();
  const svg = page.getByRole("img", { name: /Mapa Małopolski/ });
  await expect(svg).toBeVisible();
  await expect(svg.locator("g").first().locator("path")).toHaveCount(183);

  // Kolory: wzrost liczby mieszkańców na czerwono, spadek na niebiesko (skala rozbieżna).
  await page.getByLabel("Co pokazać").selectOption({ label: "Zmiana liczby mieszkańców w 10 lat" });
  await expect(map.getByText(/^-15% i mniej$/)).toBeVisible();

  // Góra i dół rankingu obok siebie; dla zmian — największe wzrosty i spadki.
  await expect(map.getByRole("region", { name: "Najwięcej na plus" }).getByRole("listitem")).toHaveCount(5);
  await expect(map.getByRole("region", { name: "Najwięcej na minus" }).getByText(/^−|^-/).first()).toBeVisible();
  // Kategorie z ikonami: Seniorzy → udział 65+.
  await map.getByText(/^Seniorzy i opieka/).click();
  await expect(page.getByLabel("Co pokazać")).toHaveValue("udzial_65plus");
  await expect(map.getByRole("region", { name: "5 gmin z najwyższą wartością" }).getByRole("listitem")).toHaveCount(5);
  await expect(map.getByRole("region", { name: "5 gmin z najniższą wartością" }).getByRole("listitem")).toHaveCount(5);

  // Klawiatura / czytnik ekranu: wyszukiwarka bez polskich znaków → podpowiedź → panel szczegółów (aria-live) i adres.
  const search = page.getByRole("combobox", { name: "Znajdź gminę" });
  await search.fill("zakop");
  await expect(page.getByRole("option", { name: /Zakopane/ })).toBeVisible();
  await search.press("Enter");
  await expect(search).toHaveValue("Zakopane");
  await expect(map.locator("div[aria-live=polite]")).toContainText("Zakopane");
  await expect(map.locator("div[aria-live=polite]")).toContainText(/miejsce na 183 gmin/);
  await expect(page).toHaveURL(/jednostka=1217011/);

  // Przełącznik warstw: wybrana gmina przechodzi na swój powiat.
  await page.getByText(/^Powiaty \(22\)$/).click();
  await expect(svg.locator("g").first().locator("path")).toHaveCount(22);
  await expect(map.locator("div[aria-live=polite]")).toContainText("powiat tatrzański");

  // Tabela z tymi samymi danymi co mapa.
  await page.getByText(/^Pokaż dane w tabeli/).click();
  await expect(page.getByRole("table", { name: /powiaty, od najwyższej wartości/ }).locator("tbody tr")).toHaveCount(22);

  const { violations } = await new AxeBuilder({ page }).include("#mapa-naglowek").include("section[aria-labelledby=mapa-naglowek]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2)}`)).toEqual([]);
});
