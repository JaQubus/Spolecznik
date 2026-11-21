import "server-only";
import { rateLimit } from "@/lib/rate-limit";
import { createPublicClient, publicClientConfigured } from "@/lib/supabase/public";
import {
  API_LIMIT_PER_MINUTE, DETAIL_COLUMNS, SUMMARY_COLUMNS, toInitiative, toSummary,
  type Initiative, type InitiativeDetailRow, type InitiativeList, type InitiativeRow, type InitiativesQuery,
} from "./contract";

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

/**
 * Kluczem anon i wyłącznie z widoku public_initiatives: tylko opublikowane inicjatywy, bez danych kontaktowych,
 * surowego tekstu i pól roboczych karty (0004_rls.sql). Tabela initiatives nie ma polityki dla anon.
 */
export async function listPublicInitiatives(q: InitiativesQuery, origin: string): Promise<InitiativeList> {
  let query = createPublicClient()
    .from("public_initiatives")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .order("signal", { ascending: false, nullsFirst: false })
    .order("title")
    .order("id")
    .range(q.offset, q.offset + q.limit - 1);
  if (q.dziedzina) query = query.contains("domains", [q.dziedzina]);
  if (q.instytucja) query = query.eq("institution_type", q.instytucja);
  if (q.etap) query = query.eq("stage", q.etap);
  if (q.teryt) query = query.eq("county_teryt", q.teryt);
  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as InitiativeRow[];
  return { items: rows.map((r) => toSummary(r, origin)), total: count ?? rows.length, limit: q.limit, offset: q.offset };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Po slugu, a dla inicjatywy bez sluga po id. */
export async function getPublicInitiative(slugOrId: string, origin: string): Promise<Initiative | null> {
  const { data, error } = await createPublicClient()
    .from("public_initiatives")
    .select(DETAIL_COLUMNS)
    .eq(UUID.test(slugOrId) ? "id" : "slug", slugOrId)
    .maybeSingle();
  if (error) throw error;
  return data ? toInitiative(data as unknown as InitiativeDetailRow, origin) : null;
}
