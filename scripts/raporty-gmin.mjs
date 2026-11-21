// Raport gminy (#104): przelicza podsumowania i dopasowania wszystkich gmin porcjami przez POST /api/raporty-gmin.
// Strona raportu działa i bez tego (szablon + innowacje z obszaru) — skrypt dodaje teksty z modelu i dopasowania.
//
//   GMINA_REPORTS_SECRET=… node scripts/raporty-gmin.mjs [adres aplikacji, domyślnie http://localhost:3000]
//
// Na darmowym planie Groq (8 tys. tokenów na minutę) całość trwa kilkadziesiąt minut; przy limicie skrypt czeka i ponawia.
import { readFileSync } from "node:fs";

function secretFromEnvFile() {
  try {
    const line = readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")
      .find((l) => l.startsWith("GMINA_REPORTS_SECRET="));
    return line?.slice("GMINA_REPORTS_SECRET=".length).trim() || undefined;
  } catch {
    return undefined;
  }
}

const base = process.argv[2] ?? "http://localhost:3000";
const secret = process.env.GMINA_REPORTS_SECRET ?? secretFromEnvFile();
if (!secret) {
  console.error("Brak GMINA_REPORTS_SECRET (w środowisku albo w .env.local). Ta sama wartość musi być ustawiona w aplikacji.");
  process.exit(1);
}

for (let round = 1; ; round++) {
  const response = await fetch(`${base}/api/raporty-gmin`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`Błąd ${response.status}: ${body.error ?? "brak opisu"}`);
    process.exit(1);
  }
  const { matches, summaries, busy } = body;
  console.log(`porcja ${round}: dopasowania ${matches.done}/${matches.total}, podsumowania ${summaries.done}/${summaries.total}${busy ? " (limit Groq)" : ""}`);
  if (matches.done === matches.total && summaries.done === summaries.total) break;
  if (busy) await new Promise((r) => setTimeout(r, 60_000));
}
console.log("Gotowe: raporty wszystkich gmin są aktualne.");
