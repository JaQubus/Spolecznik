import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../supabase/admin";
import type { TestStatus } from "../test-status";

export type TestRow = {
  id: string;
  innovation_id: string;
  tester_id: string | null;
  status: string;
  rating: number | null;
  feedback: string | null;
  suggestions: string | null;
  tester_org: string | null;
  planned_for: string | null;
  synthetic: boolean;
  created_at: string;
  innovations: { title: string; slug: string | null } | null;
  gminy: { nazwa: string; powiat: string } | null;
};

export const TEST_COLUMNS =
  "id, innovation_id, tester_id, status, rating, feedback, suggestions, tester_org, planned_for, synthetic, created_at, innovations(title, slug), gminy(nazwa, powiat)";

/** Zgłoszenia testów i oceny z /przetestuj, od najnowszych (Panel → Testy). */
export async function listTests(
  supabase: SupabaseClient,
  filter: { status?: TestStatus; innovationId?: string },
  range: { from: number; to: number },
): Promise<{ rows: TestRow[]; total: number }> {
  let query = supabase
    .from("tests")
    .select(TEST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(range.from, range.to);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.innovationId) query = query.eq("innovation_id", filter.innovationId);
  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as TestRow[], total: count ?? 0 };
}

/** Innowacje, które mają choć jeden test — do filtra „Innowacja”. */
export async function testedInnovations(supabase: SupabaseClient): Promise<{ id: string; title: string }[]> {
  // Nie tests_count: ten licznik (0004) obejmuje tylko oceny, a tu liczą się też same zgłoszenia.
  const { data, error } = await supabase
    .from("innovations")
    .select("id, title, tests!inner(id)")
    .limit(1, { referencedTable: "tests" })
    .order("title");
  if (error) throw error;
  return (data ?? []).map((i) => ({ id: i.id as string, title: i.title as string }));
}

export type TestSummary = {
  total: number;
  byStatus: Record<string, number>;
  rated: number;
  avgRating: number | null;
  suggestions: { text: string; gmina: string | null; at: string }[];
};

/** Podsumowanie testów jednej innowacji na jej stronie w Panelu → Wiedza. */
export async function innovationTestSummary(innovationId: string, suggestionCount = 5): Promise<TestSummary> {
  const { data, error } = await createAdminClient()
    .from("tests")
    .select("status, rating, suggestions, created_at, gminy(nazwa)")
    .eq("innovation_id", innovationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = Pick<TestRow, "status" | "rating" | "suggestions" | "created_at"> & { gminy: { nazwa: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  const ratings = rows.map((r) => r.rating).filter((r): r is number => r != null);
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  return {
    total: rows.length,
    byStatus,
    rated: ratings.length,
    avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    suggestions: rows
      .filter((r) => r.suggestions?.trim())
      .slice(0, suggestionCount)
      .map((r) => ({ text: r.suggestions!.trim(), gmina: r.gminy?.nazwa ?? null, at: r.created_at })),
  };
}
