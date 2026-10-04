import "server-only";
import type { TestStatus } from "../test-status";
import { createAdminClient } from "../supabase/admin";

/** Zgłoszenie testu albo ocena po teście z /przetestuj (tabela tests). */
export type TestRow = {
  id: string;
  innovation_id: string;
  status: TestStatus;
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

const TEST_COLUMNS =
  "id, innovation_id, status, rating, feedback, suggestions, tester_org, planned_for, synthetic, created_at, innovations(title, slug), gminy(nazwa, powiat)";

/** Najnowsze zgłoszenia testów do Panelu → Testy, opcjonalnie po statusie i innowacji. */
export async function listTests(filter: { status?: TestStatus; innovationId?: string }, limit = 200) {
  let query = createAdminClient()
    .from("tests")
    .select(TEST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.innovationId) query = query.eq("innovation_id", filter.innovationId);
  const { data, error, count } = await query;
  if (error) throw error;
  return { tests: (data ?? []) as unknown as TestRow[], total: count ?? 0 };
}

/** Innowacje, które mają choć jedno zgłoszenie testu — do filtra. */
export async function testedInnovations(): Promise<{ id: string; title: string }[]> {
  const { data, error } = await createAdminClient().from("tests").select("innovation_id, innovations(title)");
  if (error) throw error;
  const byId = new Map<string, string>();
  for (const r of (data ?? []) as unknown as { innovation_id: string; innovations: { title: string } | null }[]) {
    byId.set(r.innovation_id, r.innovations?.title ?? "Bez nazwy");
  }
  return [...byId].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title, "pl"));
}

export type TestSummary = {
  counts: Record<TestStatus, number>;
  ratings: number;
  avgRating: number | null;
  suggestions: Pick<TestRow, "id" | "suggestions" | "created_at" | "gminy">[];
};

/**
 * Podsumowanie testów jednej innowacji (Panel → Wiedza → edycja innowacji).
 * null bez bazy: Wiedza działa też w trybie plików, a testy są tylko w Supabase.
 */
export async function testSummary(innovationId: string, recent = 3): Promise<TestSummary | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data, error } = await createAdminClient()
    .from("tests")
    .select("id, status, rating, suggestions, created_at, gminy(nazwa, powiat)")
    .eq("innovation_id", innovationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Pick<TestRow, "id" | "status" | "rating" | "suggestions" | "created_at" | "gminy">[];
  const counts: Record<TestStatus, number> = { planowany: 0, potwierdzony: 0, zakonczony: 0 };
  for (const r of rows) if (r.status in counts) counts[r.status]++;
  const rated = rows.filter((r) => r.rating != null);
  return {
    counts,
    ratings: rated.length,
    avgRating: rated.length ? rated.reduce((sum, r) => sum + r.rating!, 0) / rated.length : null,
    suggestions: rows.filter((r) => r.suggestions?.trim()).slice(0, recent),
  };
}
