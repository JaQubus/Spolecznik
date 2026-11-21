import { apiError, apiJson, getPublicInnovation, guard, noDatabase } from "@/lib/api/v1";

/** GET /api/v1/innowacje/[slug] — jedna opublikowana innowacja z gminami testów (TERYT). */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/innowacje/[slug]">) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const { slug } = await ctx.params;
  if (slug.length > 200) return apiError(404, "Nie ma takiej innowacji");
  const unavailable = noDatabase();
  if (unavailable) return unavailable;

  try {
    const innovation = await getPublicInnovation(slug, new URL(request.url).origin);
    return innovation ? apiJson(innovation) : apiError(404, "Nie ma takiej innowacji");
  } catch (e) {
    console.error("[api/v1/innowacje/[slug]]", e);
    return apiError(503, "Nie udało się pobrać innowacji. Spróbuj ponownie za chwilę");
  }
}
