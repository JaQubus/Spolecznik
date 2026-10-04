// Makiety UX/UI (#84): zrzuty ekranów w 390 i 1440 px + docs/makiety.pdf z przepływami i adnotacjami.
// Uruchomienie (działająca aplikacja z danymi syntetycznymi, domyślnie serwer deweloperski):
//   node scripts/makiety/build.mjs
//   BASE_URL=https://spolecznik.vercel.app node scripts/makiety/build.mjs
//   node scripts/makiety/build.mjs --pdf-only   (składa PDF z istniejących zrzutów)
// Nie wywołuje Groq: stany po odpowiedzi LLM i Panel to makiety statyczne (./static.mjs).
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STATIC, TOKENS_CSS } from "./static.mjs";
import { DEMO_URL, FIGMA_URL, MODULES, PATHS, SCREENS } from "./screens.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(ROOT, "docs", "makiety");
const SHOTS = join(OUT_DIR, "ekrany");
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const WIDTHS = [1440, 390];
const MAX_HEIGHT = { 1440: 2200, 390: 3000 }; // dłuższe strony przycinamy od dołu

const referenceCss = readFileSync(join(ROOT, "docs", "design-system", "reference.css"), "utf8").replace(/^@import[^\n]*\n/, "");
const shotName = (i, s, w) => `${String(i + 1).padStart(2, "0")}-${s.id}-${w}.jpg`;

async function shoot(browser) {
  mkdirSync(SHOTS, { recursive: true });
  for (const [i, s] of SCREENS.entries()) {
    for (const width of WIDTHS) {
      const mobile = width < 768;
      const context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 900 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
        locale: "pl-PL", reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(BASE + s.url, { waitUntil: "networkidle", timeout: 180_000 });
      // Serwer deweloperski potrafi przeładować stronę po pierwszej kompilacji — chwila na uspokojenie.
      await page.waitForTimeout(1000);
      await page.waitForLoadState("networkidle");
      if (s.static) {
        await page.evaluate(({ html, css, panel }) => {
          const style = document.createElement("style");
          style.textContent = css;
          document.head.appendChild(style);
          const main = document.querySelector("main");
          main.innerHTML = `<div class="hm">${html}</div>`;
          if (panel) document.querySelectorAll("header [aria-current]").forEach((a) => a.removeAttribute("aria-current"));
        }, { html: STATIC[s.static], css: referenceCss + TOKENS_CSS, panel: s.module === "VI" });
      }
      // Bez wskaźnika Next.js w trybie deweloperskim.
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(400);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      const file = join(SHOTS, shotName(i, s, width));
      await page.screenshot({ path: file, type: "jpeg", quality: 72, fullPage: true, clip: { x: 0, y: 0, width, height: Math.min(height, MAX_HEIGHT[width]) } });
      console.log("zrzut", shotName(i, s, width), height > MAX_HEIGHT[width] ? `(przycięty z ${height}px)` : "");
      await context.close();
    }
  }
}

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const img = (file) => `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`;

function pdfHtml() {
  const byModule = Object.keys(MODULES).map((m) => ({ m, items: SCREENS.map((s, i) => ({ s, n: i + 1 })).filter(({ s }) => s.module === m) }));
  const loop = Object.keys(PATHS).map((p) => {
    const items = SCREENS.map((s, i) => ({ s, n: i + 1 })).filter(({ s }) => s.path === p);
    return `<div class="path"><h3>${PATHS[p]}</h3><ol class="chain">${items.map(({ s, n }) => `<li><span class="n">${n}</span> ${esc(s.title)} <span class="mod">${s.module}</span></li>`).join("")}</ol></div>`;
  }).join("");

  const pages = SCREENS.map((s, i) => {
    const next = SCREENS[i + 1];
    return `<section class="screen">
      <header><p class="kicker">Ekran ${i + 1} z ${SCREENS.length} · ${PATHS[s.path]}</p>
        <h2>${esc(s.title)}</h2>
        <p class="meta"><span class="mod">Moduł ${s.module} — ${MODULES[s.module]}</span>
        <span class="src ${s.static ? "static" : "live"}">${s.static ? "Makieta statyczna — stan po odpowiedzi LLM lub za logowaniem" : "Zrzut działającej aplikacji"}</span>
        <code>${esc(s.url)}</code></p></header>
      <div class="body">
        <aside>
          <h4>Co się dzieje</h4><p>${esc(s.what)}</p>
          <h4>Decyzje dostępności</h4><ul>${s.a11y.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
          ${next ? `<h4>Dalej</h4><p>→ ${i + 2}. ${esc(next.title)}</p>` : ""}
        </aside>
        <figure class="desk"><img src="${img(join(SHOTS, shotName(i, s, 1440)))}" alt=""><figcaption>Komputer, 1440 px</figcaption></figure>
        <figure class="phone"><img src="${img(join(SHOTS, shotName(i, s, 390)))}" alt=""><figcaption>Telefon, 390 px</figcaption></figure>
      </div></section>`;
  }).join("");

  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Społecznik — makiety UX/UI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@500&family=Atkinson+Hyperlegible+Next:wght@400;700&display=swap" rel="stylesheet">
  <style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 400 11pt/1.45 "Atkinson Hyperlegible Next", sans-serif; color: #222; }
  h1,h2,h3,h4 { margin: 0; } a { color: #222; font-weight: 700; }
  section { page-break-after: always; height: 189mm; overflow: hidden; }
  .flag { height: 3mm; background: #dc143c; border-top: 1.2mm solid #fff; box-shadow: 0 -0.3mm 0 #e6e1d9; margin-bottom: 8mm; }
  .cover { background: #f7f4ef; padding: 0 16mm; }
  .cover h1 { font-size: 46pt; line-height: 1.05; margin: 22mm 0 6mm; }
  .cover .lead { font-size: 15pt; max-width: 200mm; }
  .cover dl { display: grid; grid-template-columns: 38mm 1fr; gap: 3mm 6mm; margin-top: 12mm; font-size: 12pt; }
  .cover dt { font-weight: 700; } .cover dd { margin: 0; }
  .muted { color: #625d57; }
  .legend { display: flex; gap: 8mm; margin-top: 10mm; }
  .src { display: inline-block; border-radius: 99px; padding: 0.6mm 3mm; font-size: 9.5pt; }
  .src.live { background: #ece7df; } .src.static { background: #222; color: #fff; }
  .overview { padding: 4mm 6mm; }
  .overview h2 { font-size: 22pt; margin-bottom: 3mm; }
  .cols { display: grid; grid-template-columns: 1.3fr 1fr; gap: 10mm; margin-top: 5mm; }
  .path { margin-bottom: 5mm; } .path h3 { font-size: 12.5pt; margin-bottom: 2mm; }
  .chain { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 2mm; }
  .chain li { background: #f7f4ef; border-radius: 99px; padding: 1mm 3.5mm; font-size: 10pt; }
  .chain li + li::before { content: "→ "; color: #625d57; }
  .n { font-weight: 700; } .mod { font-weight: 700; }
  .chain .mod { color: #625d57; font-size: 9pt; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  th, td { text-align: left; padding: 1.6mm 2mm 1.6mm 0; border-bottom: 0.3mm solid #e6e1d9; vertical-align: top; }
  .rules { columns: 2; column-gap: 10mm; font-size: 10pt; padding-left: 4mm; margin: 2mm 0 0; }
  .rules li { margin-bottom: 1.2mm; break-inside: avoid; }
  .screen header { border-bottom: 0.3mm solid #e6e1d9; padding-bottom: 2mm; margin-bottom: 3mm; }
  .kicker { margin: 0; font-size: 9.5pt; color: #625d57; }
  .screen h2 { font-size: 18pt; }
  .meta { margin: 1mm 0 0; display: flex; gap: 4mm; align-items: center; flex-wrap: wrap; font-size: 10pt; }
  code { font-family: "Atkinson Hyperlegible Mono", monospace; font-size: 9.5pt; color: #625d57; }
  .body { display: grid; grid-template-columns: 62mm 1fr 44mm; gap: 5mm; height: 158mm; }
  aside { font-size: 10pt; } aside h4 { font-size: 10.5pt; margin: 3mm 0 1mm; } aside h4:first-child { margin-top: 0; }
  aside ul { padding-left: 4mm; margin: 0; } aside li { margin-bottom: 1.2mm; } aside p { margin: 0; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 1.5mm; min-height: 0; }
  figure img { width: 100%; height: 100%; object-fit: cover; object-position: top; border: 0.3mm solid #e6e1d9; border-radius: 2mm; min-height: 0; }
  figcaption { font-size: 9pt; color: #625d57; }
  </style></head><body>
  <section class="cover"><div class="flag"></div>
    <p class="muted">HackYeah 2026 · Małopolski Hub Innowacji Społecznych</p>
    <h1>Społecznik<br>makiety UX/UI</h1>
    <p class="lead">${SCREENS.length} ekranów w kolejności pętli innowacji, każdy w widoku komputera (1440 px) i telefonu (390 px), z modułem briefu (I–VII) i decyzjami dostępności (WCAG 2.1 AA).</p>
    <dl>
      <dt>Demo</dt><dd><a href="${DEMO_URL}">${DEMO_URL.replace("https://", "")}</a></dd>
      <dt>Dodatek: Figma</dt><dd><a href="${FIGMA_URL}">System projektowy i ekrany w Figmie</a> — zmienne, style tekstu, komponenty</dd>
      <dt>Dane</dt><dd>Wyłącznie syntetyczne: postacie, gminy w zgłoszeniach, kody SPL i osoby w Panelu są wymyślone.</dd>
      <dt>Odświeżenie</dt><dd><code>node scripts/makiety/build.mjs</code> (Playwright, bez wywołań LLM)</dd>
    </dl>
    <div class="legend"><span class="src live">Zrzut działającej aplikacji</span><span class="src static">Makieta statyczna — stan po odpowiedzi LLM lub za logowaniem</span></div>
  </section>
  <section class="overview">
    <h2>Pętla innowacji</h2>
    <p class="muted">Moduły nie są osobnymi zakładkami, tylko kolejnymi krokami jednego procesu: potrzeba → dopasowanie → wdrożenie → próba → biblioteka; a gdy rozwiązania brak: luka → pracownia → rozmowy → nabór.</p>
    <div class="cols"><div>${loop}</div>
      <div><h3 style="font-size:12.5pt;margin-bottom:2mm">Moduły briefu → ekrany</h3>
        <table><thead><tr><th>Moduł</th><th>Ekrany</th></tr></thead><tbody>
        ${byModule.map(({ m, items }) => `<tr><td><strong>${m}</strong> ${MODULES[m]}</td><td>${items.map(({ n }) => n).join(", ")}</td></tr>`).join("")}
        </tbody></table></div></div>
    <h3 style="font-size:12.5pt;margin-top:6mm">Zasady wspólne dla wszystkich ekranów</h3>
    <ul class="rules">
      <li>Jeden zielony przycisk na widok; reszta to obrys ink albo podkreślony tekst.</li>
      <li>Atkinson Hyperlegible Next, baza 18 px, nic mniejszego niż 16 px.</li>
      <li>Cele dotykowe ≥ 48 px, kontrolki 56 px.</li>
      <li>Fokus: obrys 3 px, odsunięty o 3 px, na każdym elemencie.</li>
      <li>Ikony Heroicons zawsze obok słowa; bez przycisków z samą ikoną.</li>
      <li>Wyniki asynchroniczne przez aria-live; błędy z ikoną i słowami.</li>
      <li>Trzy motywy: Jasny, Ciemny, Wysoki kontrast (≥ 7:1).</li>
      <li>Bez kart w wierszach: obszary dzieli zmiana tła, listy — linie.</li>
    </ul>
  </section>
  ${pages}
  </body></html>`;
}

const browser = await chromium.launch();
if (!process.argv.includes("--pdf-only")) await shoot(browser);
for (const [i, s] of SCREENS.entries()) for (const w of WIDTHS) if (!existsSync(join(SHOTS, shotName(i, s, w)))) throw new Error(`Brak zrzutu ${shotName(i, s, w)}`);
const page = await browser.newPage();
await page.setContent(pdfHtml(), { waitUntil: "networkidle" });
await page.pdf({ path: join(ROOT, "docs", "makiety.pdf"), format: "A4", landscape: true, printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log("gotowe: docs/makiety.pdf");
