// Lighthouse dla ścieżki głównej (#26): wynik na slajd i sprawdzenie progu dostępności.
//
//   node scripts/lighthouse.mjs                         # https://spolecznik.vercel.app, telefon
//   node scripts/lighthouse.mjs http://localhost:3000   # inny adres
//   node scripts/lighthouse.mjs --desktop
//
// Przeglądarka: Chromium z Playwrighta (już jest do testów e2e), więc nie trzeba instalować Chrome.
// Lighthouse pobiera npx przy pierwszym uruchomieniu — nie jest zależnością projektu.
// Pełne raporty HTML lądują w lighthouse-report/. Kod wyjścia 1, gdy dostępność na którejś stronie < 95.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const LIGHTHOUSE = "lighthouse@13";
const A11Y_MIN = 95;
// Ścieżka główna mieszkańca: start → opis problemu → status (kod nieistniejący też jest ekranem) → rozmowa.
const PAGES = ["/", "/opisz", "/status/SPL-AAAA", "/zapytaj", "/pomysl", "/biblioteka"];
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

const args = process.argv.slice(2);
const desktop = args.includes("--desktop");
const base = (args.find((a) => !a.startsWith("--")) ?? "https://spolecznik.vercel.app").replace(/\/$/, "");
const outDir = "lighthouse-report";
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Na Windows npx to skrypt .cmd, który wymaga powłoki (i nie escapuje argumentów) — wołamy npx-cli.js przez node.
const [npx, npxArgs] = process.platform === "win32"
  ? [process.execPath, [join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js")]]
  : ["npx", []];
const rows = [];
for (const path of PAGES) {
  const name = path === "/" ? "start" : path.slice(1).replaceAll("/", "_");
  const out = join(outDir, name);
  process.stdout.write(`${path} … `);
  try {
    execFileSync(npx, [
      ...npxArgs, "-y", LIGHTHOUSE, `${base}${path}`,
      `--only-categories=${CATEGORIES.join(",")}`,
      ...(desktop ? ["--preset=desktop"] : []),
      "--output=json", "--output=html", `--output-path=${out}`,
      "--chrome-flags=--headless=new --no-sandbox",
      "--quiet",
    ], { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, stdio: ["ignore", "ignore", "pipe"] });
    const report = JSON.parse(readFileSync(`${out}.report.json`, "utf8"));
    const scores = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((report.categories[c]?.score ?? 0) * 100)]));
    // Nieprzechodzące audyty dostępności — od razu wiadomo, co poprawić.
    const a11yFails = report.categories.accessibility.auditRefs
      .map((r) => report.audits[r.id])
      .filter((a) => a.score !== null && a.score < 1 && !["manual", "informative", "notApplicable"].includes(a.scoreDisplayMode))
      .map((a) => a.id);
    rows.push({ path, ...scores, a11yFails });
    console.log("ok");
  } catch (e) {
    rows.push({ path, error: (e.stderr?.toString() || e.message).trim().split("\n").at(-1) });
    console.log("błąd");
  }
}

console.log(`\nLighthouse ${desktop ? "desktop" : "telefon"} · ${base}\n`);
console.log(["strona".padEnd(18), "wydajn.", "dostępn.", "prakt.", "SEO"].join("  "));
for (const r of rows) {
  if (r.error) { console.log(`${r.path.padEnd(18)}  BŁĄD: ${r.error}`); continue; }
  console.log([r.path.padEnd(18), ...CATEGORIES.map((c, i) => String(r[c]).padStart([7, 8, 6, 3][i]))].join("  "));
  if (r.a11yFails.length) console.log(`${"".padEnd(18)}  dostępność do poprawy: ${r.a11yFails.join(", ")}`);
}
console.log(`\nRaporty HTML: ${outDir}/`);

const failed = rows.filter((r) => r.error || r.accessibility < A11Y_MIN);
if (failed.length) {
  console.log(`Poniżej progu dostępności ${A11Y_MIN} albo błąd: ${failed.map((r) => r.path).join(", ")}`);
  process.exit(1);
}
