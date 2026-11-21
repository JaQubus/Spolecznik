import { apiError, apiJson, getPublicInitiative, guard, noDatabase } from "@/lib/api/v1";

/** GET /api/v1/inicjatywy/[slug] — jedna opublikowana inicjatywa. */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/inicjatywy/[slug]">) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const { slug } = await ctx.params;
  if (slug.length > 200) return apiError(404, "Nie ma takiej inicjatywy");
  const unavailable = noDatabase();
  if (unavailable) return unavailable;

  try {
    const initiative = await getPublicInitiative(slug, new URL(request.url).origin);
    return initiative ? apiJson(initiative) : apiError(404, "Nie ma takiej inicjatywy");
  } catch (e) {
    console.error("[api/v1/inicjatywy/[slug]]", e);
    return apiError(503, "Nie udało się pobrać inicjatywy. Spróbuj ponownie za chwilę");
  }
}
