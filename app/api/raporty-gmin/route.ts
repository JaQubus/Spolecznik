import { timingSafeEqual } from "node:crypto";
import { isAdmin } from "@/lib/auth";
import { MissingMigrationError, rebuildStep } from "@/lib/gmina-report/rebuild";

// Jedna porcja trwa do ok. 30 s (BUDGET_MS) plus ostatnie wywołanie Groq.
export const maxDuration = 60;
const BUDGET_MS = 30_000;

/** Sekret dla skryptu (scripts/raporty-gmin.mjs), bez logowania. Porównanie w stałym czasie. */
function hasSecret(request: Request): boolean {
  const secret = process.env.GMINA_REPORTS_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Raport gminy (#104): przelicza porcję podsumowań i dopasowań z modelu. Wołać, aż matches.done == matches.total
 * i summaries.done == summaries.total. Tylko admin ROPS albo skrypt z GMINA_REPORTS_SECRET.
 */
export async function POST(request: Request) {
  if (!hasSecret(request) && !(await isAdmin())) {
    return Response.json({ error: "Przeliczać raporty może tylko administrator ROPS" }, { status: 403 });
  }
  try {
    return Response.json(await rebuildStep(BUDGET_MS));
  } catch (e) {
    if (e instanceof MissingMigrationError) {
      return Response.json({ error: "W bazie nie ma tabel raportów. Uruchom migrację supabase/migrations/0026_gmina_reports.sql." }, { status: 503 });
    }
    console.error("[raporty-gmin]", e);
    return Response.json({ error: "Nie udało się przeliczyć raportów. Szczegóły są w logach serwera." }, { status: 500 });
  }
}
