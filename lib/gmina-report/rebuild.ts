import "server-only";
import { knowledge } from "@/lib/knowledge";
import type { AreaKey } from "@/lib/knowledge/types";
import { GroqBusyError } from "@/lib/groq";
import { gminaSummary } from "@/lib/llm";
import { rankInnovations } from "@/lib/match";
import { GAP_THRESHOLD, type NeedCard } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTable } from "@/lib/supabase/server";
import { AREA_QUERIES, INNOVATIONS_PER_AREA } from "./config";
import { COHORTS, gminaProfile } from "./index";
import type { GminaProfile } from "./score";
import { allowedNumbers, checkSentence, checkSummary, cohortProfile, numbersIn, summaryFacts, templateSummary } from "./summary";
import { matchVersion, summaryVersion } from "./version";

/** Tabel z migracji 0026_gmina_reports.sql nie ma w bazie. */
export class MissingMigrationError extends Error {}

export type RebuildResult = {
  matches: { done: number; total: number };
  summaries: { done: number; total: number };
  /** Groq odmówił (limit tokenów) — trzeba wywołać ponownie za chwilę. */
  busy: boolean;
};

/** Wyzwania obszaru z Mapy Wyzwań (tabela areas) — opis problemu dla silnika dopasowań. */
async function challengesOf(area: AreaKey): Promise<string> {
  const a = await knowledge.area(area).catch(() => null);
  return a?.challenges.join(" ") ?? "";
}

/** Stan Biblioteki: nowa albo zmieniona innowacja = dopasowania do przeliczenia. */
async function librarySignature(): Promise<string> {
  const { data, count, error } = await createAdminClient()
    .from("innovations").select("updated_at", { count: "exact" }).eq("published", true)
    .order("updated_at", { ascending: false }).limit(1);
  if (error) throw error;
  return `${count ?? 0}:${data?.[0]?.updated_at ?? ""}`;
}

/**
 * Jedna porcja przeliczania raportów gmin (#104), mieszcząca się w budgetMs: najpierw brakujące dopasowania
 * (obszar × grupa porównawcza), potem podsumowania gmin. Wywoływać, aż nic nie zostanie (scripts/raporty-gmin.mjs).
 * Przy limicie Groq kończy porcję i zwraca busy — nic nie zapisuje zastępczo, żeby następna porcja spróbowała jeszcze raz.
 */
export async function rebuildStep(budgetMs = 45_000): Promise<RebuildResult> {
  const started = Date.now();
  const timeLeft = () => Date.now() - started < budgetMs;
  const supabase = createAdminClient();
  const profiles = COHORTS.flatMap((c) => c.members).map(gminaProfile).filter((p): p is GminaProfile => p != null);

  // Pary (obszar, grupa) potrzebne którejkolwiek gminie; profil grupy jest wspólny, więc wystarczy jedna gmina z grupy.
  const pairs = new Map<string, { area: AreaKey; profile: GminaProfile }>();
  for (const p of profiles) for (const area of p.focus) pairs.set(`${area}|${p.cohort.key}`, { area, profile: p });

  const [library, existingMatches, existingSummaries] = await Promise.all([
    librarySignature(),
    supabase.from("gmina_report_matches").select("area, cohort, data_version"),
    supabase.from("gmina_reports").select("teryt, data_version"),
  ]);
  for (const r of [existingMatches, existingSummaries]) {
    if (isMissingTable(r.error)) throw new MissingMigrationError("Brak migracji 0026_gmina_reports.sql");
    if (r.error) throw r.error;
  }
  const matchDone = new Map((existingMatches.data ?? []).map((m) => [`${m.area}|${m.cohort}`, m.data_version as string]));
  const summaryDone = new Map((existingSummaries.data ?? []).map((s) => [s.teryt as string, s.data_version as string]));

  const challenges = new Map<AreaKey, string>();
  const challengesFor = async (area: AreaKey) => {
    if (!challenges.has(area)) challenges.set(area, await challengesOf(area));
    return challenges.get(area)!;
  };

  let busy = false;
  let matchesLeft = 0;
  for (const [key, { area, profile }] of pairs) {
    const version = matchVersion(profile, area, await challengesFor(area), library);
    if (matchDone.get(key) === version) continue;
    if (busy || !timeLeft()) { matchesLeft++; continue; }

    const q = AREA_QUERIES[area];
    const card: NeedCard = {
      summary: q.summary, areas: [area], groups: [], cross: [], gmina: null, keywords: q.keywords,
      alreadyTried: null, clarity: 1, followUp: null,
    };
    const profileText = cohortProfile(profile, area);
    try {
      const ranked = await rankInnovations({ card, text: `${q.summary} ${challenges.get(area)}`.trim(), gminaProfile: profileText });
      const known = numbersIn(profileText).map((n) => n.value);
      // „Co uwzględnić u Was” tylko z liczbami, które model dostał; inaczej zostaje samo „dlaczego pasuje”.
      const items = ranked.filter((m) => m.fit >= GAP_THRESHOLD).slice(0, INNOVATIONS_PER_AREA).map((m) => ({
        id: m.id, fit: m.fit, why: m.why, adapt: m.adapt && checkSentence(m.adapt, known).ok ? m.adapt : null,
      }));
      const { error } = await supabase.from("gmina_report_matches").upsert({
        area, cohort: profile.cohort.key, items, data_version: version, generated_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (e) {
      if (!(e instanceof GroqBusyError)) throw e;
      busy = true;
      matchesLeft++;
    }
  }

  let summariesLeft = 0;
  for (const p of profiles) {
    const version = summaryVersion(p);
    if (summaryDone.get(p.teryt) === version) continue;
    if (busy || !timeLeft()) { summariesLeft++; continue; }

    let text = templateSummary(p);
    let source: "llm" | "szablon" = "szablon";
    try {
      const fromModel = await gminaSummary(summaryFacts(p));
      const check = checkSummary(fromModel, allowedNumbers(p));
      if (check.ok) { text = fromModel; source = "llm"; }
      else console.warn(`[raporty-gmin] ${p.name}: szablon zamiast modelu (${check.reason})`);
    } catch (e) {
      if (e instanceof GroqBusyError) { busy = true; summariesLeft++; continue; }
      console.error(`[raporty-gmin] ${p.name}: szablon zamiast modelu`, e);
    }
    const { error } = await supabase.from("gmina_reports").upsert({
      teryt: p.teryt, summary: text, summary_source: source, data_version: version, generated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  return {
    matches: { done: pairs.size - matchesLeft, total: pairs.size },
    summaries: { done: profiles.length - summariesLeft, total: profiles.length },
    busy,
  };
}
