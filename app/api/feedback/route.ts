import { FeedbackRequest } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

/** 👍 / 👎 przy wyniku dopasowania. Zbieramy, nie trenujemy na tym (README, MoSCoW). */
export async function POST(request: Request) {
  const parsed = FeedbackRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { matchId, value } = parsed.data;
  const { data, error } = await createAdminClient()
    .from("matches")
    .update({ feedback: value === 0 ? null : value })
    .eq("id", matchId)
    .select("id");
  if (error) {
    console.error("[feedback]", error);
    return Response.json({ error: "Nie udało się zapisać oceny" }, { status: 500 });
  }
  if (!data?.length) return Response.json({ error: "Nie znaleziono dopasowania" }, { status: 404 });
  return Response.json({ ok: true });
}
