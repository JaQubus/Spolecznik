import "server-only";
import gminyJson from "@/data/out/gminy.json";
import { rateLimit } from "@/lib/rate-limit";
import { createPublicClient, publicClientConfigured } from "@/lib/supabase/public";
import {
  API_LIMIT_PER_MINUTE, DETAIL_COLUMNS, SUMMARY_COLUMNS, summarizeTests, toInnovation, toSummary,
  type Innovation, type InnovationDetailRow, type InnovationList, type InnovationRow, type InnovationsQuery,
} from "./contract";

const GMINY = new Map(gminyJson.map((g) => [g.teryt, { nazwa: g.nazwa, powiat: g.powiat }]));

const CORS = { "Access-Control-Allow-Origin": "*" };
const CACHE = "public, s-maxage=300, stale-while-revalidate=3600";

export function apiJson(body: unknown): Response {
  return Response.json(body, { headers: { ...CORS, "Cache-Control": CACHE } });
}

export function apiError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
}

/** Limit zapytań na początku każdej trasy v1. Zwraca gotową odpowiedź 429 albo null. */
export function guard(request: Request): Response | null {
  const limited = rateLimit(request, "api-v1", API_LIMIT_PER_MINUTE);
  limited?.headers.set("Access-Control-Allow-Origin", "*");
  return limited;
}

/** Po sprawdzeniu parametrów: bez bazy (np. praca nad samym UI) nie ma czego zwrócić. */
export function noDatabase(): Response | null {
  return publicClientConfigured() ? null : apiError(503, "API wymaga bazy danych, a ta instancja jej nie ma");
}

/** Id innowacji z testami w gminie (7 cyfr) albo w powiecie (4 cyfry — pierwsze cyfry kodu gminy). */
async function testedInnovationIds(teryt: string): Promise<string[]> {
  const supabase = createPublicClient();
  const query = supabase.from("tests").select("innovation_id");
  const { data, error } = await (teryt.length === 7 ? query.eq("teryt", teryt) : query.like("teryt", `${teryt}%`));
  if (error) throw error;
  return [...new Set((data ?? []).map((t) => t.innovation_id as string))];
}

export async function listPublicInnovations(q: InnovationsQuery, origin: string): Promise<InnovationList> {
  const supabase = createPublicClient();
  let query = supabase
    .from("innovations")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .eq("published", true) // RLS i tak to wymusza dla anon; tu na wypadek zmiany polityki
    .order("title")
    .order("id")
    .range(q.offset, q.offset + q.limit - 1);
  if (q.obszar) query = query.contains("areas", [q.obszar]);
  if (q.grupa) query = query.contains("target_groups", [q.grupa]);
  if (q.teryt) {
    const ids = await testedInnovationIds(q.teryt);
    if (!ids.length) return { items: [], total: 0, limit: q.limit, offset: q.offset };
    query = query.in("id", ids);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as InnovationRow[];
  return { items: rows.map((r) => toSummary(r, origin)), total: count ?? rows.length, limit: q.limit, offset: q.offset };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Po slugu, a dla innowacji bez sluga po id — jak getInnovation w lib/innovations.ts. */
export async function getPublicInnovation(slugOrId: string, origin: string): Promise<Innovation | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("innovations")
    .select(DETAIL_COLUMNS)
    .eq("published", true)
    .eq(UUID.test(slugOrId) ? "id" : "slug", slugOrId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as InnovationDetailRow;
  // Tylko gmina i status: treść ocen, organizacja i osoba testująca nie wychodzą z bazy.
  const tests = await supabase.from("tests").select("teryt, status").eq("innovation_id", row.id);
  if (tests.error) throw tests.error;
  return toInnovation(row, summarizeTests(tests.data ?? [], GMINY), origin);
}
