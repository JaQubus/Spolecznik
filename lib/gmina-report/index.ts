import "server-only";
import mapJson from "@/public/mapa/malopolska.json";
import type { AreaKey, InnovationType } from "@/lib/knowledge/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTable, isSupabaseConfigured } from "@/lib/supabase/server";
import { INNOVATIONS_PER_AREA } from "./config";
import { buildCohorts, profileFor, type GminaProfile, type ReportData } from "./score";
import { templateSummary } from "./summary";
import { summaryVersion } from "./version";

/** Dane raportu: te same co mapa „Kondycja Małopolski” (data/knowledge_map.py → public/mapa/malopolska.json). */
export const REPORT_DATA = { gminy: mapJson.layers.gminy, powiaty: mapJson.layers.powiaty } as unknown as ReportData;
export const COHORTS = buildCohorts(REPORT_DATA.gminy.units);

export const gminaProfile = (teryt: string) => profileFor(teryt, REPORT_DATA, COHORTS);

/** Gminy do wyszukiwarki raportów (bez granic i wartości). */
export const REPORT_UNITS = REPORT_DATA.gminy.units.map(({ id, name, parent, kind }) => ({ id, name, parent, kind }));

/** Pozycja z gmina_report_matches.items (lib/gmina-report/rebuild.ts). */
export type StoredMatch = { id: string; fit: number; why: string; adapt: string | null };

export type ReportInnovation = {
  id: string;
  title: string;
  slug: string | null;
  testsCount: number;
  avgRating: number | null;
  innovationType: InnovationType | null;
  synthetic: boolean;
  /** „Dlaczego to może zadziałać u Was” z reranku; null, gdy innowacja jest tylko z tego samego obszaru. */
  why: string | null;
};

export type FocusArea = {
  area: AreaKey;
  /** true: dopasowanie silnikiem z Dopasuj; false: innowacje z obszaru, zanim raport przeliczono. */
  matched: boolean;
  innovations: ReportInnovation[];
  /** Gminy z tej samej grupy porównawczej ze zgłoszeniami w tym obszarze — tylko nazwy, jak w „Opisz problem”. */
  similarGminy: { teryt: string; name: string }[];
};

export type GminaReport = {
  profile: GminaProfile;
  summary: { text: string; source: "llm" | "szablon"; generatedAt: string | null };
  focus: FocusArea[];
  /** null bez bazy danych. Liczby zgłoszeń z tej gminy według obszarów, bez treści. */
  voices: { total: number; byArea: { area: AreaKey; count: number }[]; synthetic: boolean } | null;
  calls: { id: string; title: string; closesAt: string | null; synthetic: boolean }[];
  database: boolean;
};

type NeedRow = { teryt: string | null; synthetic: boolean; areas: AreaKey[] | null };

const today = () => new Date().toISOString().slice(0, 10);

/** Ta sama innowacja bywa w obu korpusach (Zasobnik i pipeline dopasowań) — na liście wystarczy raz. */
function uniqueByTitle<T extends { title: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = r.title.trim().toLowerCase();
    return !seen.has(key) && seen.add(key);
  });
}

/**
 * Raport gminy do strony. Liczby liczy kod przy każdym wyświetleniu, teksty i dopasowania z modelu czyta z bazy
 * (gmina_reports, gmina_report_matches). Bez wywołań LLM: gdy raportu jeszcze nie przeliczono, jest szablon
 * podsumowania i innowacje z obszaru bez dopasowania.
 */
export async function loadReport(teryt: string): Promise<GminaReport | null> {
  const profile = gminaProfile(teryt);
  if (!profile) return null;
  const fallback = { text: templateSummary(profile), source: "szablon" as const, generatedAt: null };
  const empty = (area: AreaKey): FocusArea => ({ area, matched: false, innovations: [], similarGminy: [] });

  if (!isSupabaseConfigured()) {
    return { profile, summary: fallback, focus: profile.focus.map(empty), voices: null, calls: [], database: false };
  }
  const supabase = createAdminClient();

  const [stored, matches, needs, callHits] = await Promise.all([
    supabase.from("gmina_reports").select("summary, summary_source, generated_at, data_version").eq("teryt", teryt).maybeSingle(),
    profile.focus.length
      ? supabase.from("gmina_report_matches").select("area, items").eq("cohort", profile.cohort.key).in("area", profile.focus)
      : Promise.resolve({ data: [], error: null }),
    // Zamknięte zgłoszenia nie liczą się (jak „inne gminy zgłosiły podobny problem” w embed.py / Dopasuj).
    supabase.from("needs").select("teryt, synthetic, areas:card->areas").neq("status", "zamkniete")
      .in("teryt", profile.cohort.members),
    profile.focus.length
      ? supabase.from("search_index").select("ref_id").eq("kind", "nabor").eq("active", true).overlaps("areas", profile.focus)
      : Promise.resolve({ data: [], error: null }),
  ]);
  // Bez migracji 0026 raport działa dalej na szablonie i innowacjach z obszaru.
  for (const r of [stored, matches]) if (r.error && !isMissingTable(r.error)) throw r.error;
  for (const r of [needs, callHits]) if (r.error) throw r.error;

  const storedByArea = new Map(((matches.data ?? []) as { area: AreaKey; items: StoredMatch[] }[]).map((m) => [m.area, m.items]));

  // Innowacje: dopasowane (z bazy) albo — dla obszaru jeszcze nieprzeliczonego — z tego obszaru, najczęściej testowane.
  const matchedIds = [...storedByArea.values()].flat().map((m) => m.id);
  const missing = profile.focus.filter((a) => !storedByArea.get(a)?.length);
  const columns = "id, title, slug, tests_count, avg_rating, synthetic, innovation_type, areas";
  const [byId, ...byArea] = await Promise.all([
    matchedIds.length
      ? supabase.from("innovations").select(columns).eq("published", true).in("id", matchedIds)
      : Promise.resolve({ data: [], error: null }),
    ...missing.map((area) =>
      supabase.from("innovations").select(columns).eq("published", true).contains("areas", [area])
        .order("tests_count", { ascending: false }).order("title").limit(INNOVATIONS_PER_AREA * 3)),
  ]);
  for (const r of [byId, ...byArea]) if (r.error) throw r.error;

  type Row = { id: string; title: string; slug: string | null; tests_count: number | null; avg_rating: number | null; synthetic: boolean; innovation_type: InnovationType | null };
  const toInnovation = (i: Row, why: string | null): ReportInnovation => ({
    id: i.id,
    title: i.title,
    slug: i.slug,
    testsCount: i.tests_count ?? 0,
    avgRating: i.avg_rating != null ? Number(i.avg_rating) : null,
    innovationType: i.innovation_type,
    synthetic: i.synthetic,
    why,
  });
  const rowById = new Map(((byId.data ?? []) as Row[]).map((i) => [i.id, i]));

  const needRows = (needs.data ?? []) as NeedRow[];
  const nameOf = new Map(REPORT_DATA.gminy.units.map((u) => [u.id, u.name]));

  const focus: FocusArea[] = profile.focus.map((area) => {
    const items = storedByArea.get(area) ?? [];
    const fromArea = byArea[missing.indexOf(area)]?.data as Row[] | undefined;
    const innovations = items.length
      ? items.flatMap((m) => { const i = rowById.get(m.id); return i ? [toInnovation(i, m.adapt ?? m.why)] : []; })
      : uniqueByTitle(fromArea ?? []).slice(0, INNOVATIONS_PER_AREA).map((i) => toInnovation(i, null));
    const similar = [...new Set(needRows.filter((n) => n.teryt && n.teryt !== teryt && n.areas?.includes(area)).map((n) => n.teryt!))]
      .map((t) => ({ teryt: t, name: nameOf.get(t) ?? t }))
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
    return { area, matched: items.length > 0, innovations, similarGminy: similar };
  });

  const own = needRows.filter((n) => n.teryt === teryt);
  const counts = new Map<AreaKey, number>();
  for (const n of own) for (const a of n.areas ?? []) counts.set(a, (counts.get(a) ?? 0) + 1);
  const voices = {
    total: own.length,
    byArea: [...counts].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count),
    synthetic: own.some((n) => n.synthetic),
  };

  const callIds = ((callHits.data ?? []) as { ref_id: string }[]).map((c) => c.ref_id);
  const calls = callIds.length
    ? await supabase.from("calls").select("id, title, closes_at, synthetic").eq("active", true).in("id", callIds)
      .or(`closes_at.is.null,closes_at.gte.${today()}`).order("closes_at", { ascending: true, nullsFirst: false })
    : { data: [], error: null };
  if (calls.error) throw calls.error;

  // Podsumowanie z innych danych (np. nowy rok BDL przed przeliczeniem) mogłoby podać nieaktualne liczby — wtedy szablon.
  const s = stored.data as { summary: string; summary_source: "llm" | "szablon"; generated_at: string; data_version: string } | null;
  const current = s && s.data_version === summaryVersion(profile);
  return {
    profile,
    summary: current ? { text: s.summary, source: s.summary_source, generatedAt: s.generated_at } : fallback,
    focus,
    voices,
    calls: ((calls.data ?? []) as { id: string; title: string; closes_at: string | null; synthetic: boolean }[])
      .map((c) => ({ id: c.id, title: c.title, closesAt: c.closes_at, synthetic: c.synthetic })),
    database: true,
  };
}
