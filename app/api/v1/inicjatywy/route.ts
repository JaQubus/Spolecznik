import { InnovationsQuery } from "@/lib/api/contract";
import { apiError, apiJson, guard, listPublicInnovations, noDatabase } from "@/lib/api/v1";

/** GET /api/v1/innowacje — publiczny katalog innowacji (#67). Kontrakt: lib/api/contract.ts. */
export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const url = new URL(request.url);
  // Puste parametry (?obszar=) traktujemy jak brak filtra.
  const params = Object.fromEntries([...url.searchParams].filter(([, v]) => v.trim() !== ""));
  const parsed = InnovationsQuery.safeParse(params);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return apiError(400, `Nieprawidłowy parametr „${String(issue.path[0] ?? "?")}”: ${issue.message}`);
  }
  const unavailable = noDatabase();
  if (unavailable) return unavailable;

  try {
    return apiJson(await listPublicInnovations(parsed.data, url.origin));
  } catch (e) {
    console.error("[api/v1/innowacje]", e);
    return apiError(503, "Nie udało się pobrać innowacji. Spróbuj ponownie za chwilę");
  }
}
