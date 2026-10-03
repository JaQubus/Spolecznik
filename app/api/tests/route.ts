import { findGmina } from "@/lib/gminy";
import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { TestRequest } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Próba: „Chcę przetestować” albo ocena po teście. Liczniki na karcie innowacji odświeża trigger (0004). */
export async function POST(request: Request) {
  const limited = rateLimit(request, "tests", 5);
  if (limited) return limited;
  const parsed = TestRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const t = parsed.data;

  try {
    const gmina = await findGmina(t.gmina, t.teryt);
    if (!gmina) return Response.json({ error: "Nie znaleźliśmy gminy o tej nazwie" }, { status: 404 });

    const tester = await createClient()
      .then((s) => s.auth.getUser())
      .then(({ data }) => data.user?.id ?? null)
      .catch(() => null);

    const clean = (s?: string) => (s?.trim() ? anonymize(s.trim()).text : null);
    const { error } = await createAdminClient().from("tests").insert({
      innovation_id: t.innovationId,
      tester_id: tester,
      teryt: gmina.teryt,
      status: t.status,
      rating: t.status === "zakonczony" ? t.rating : null,
      feedback: clean(t.feedback),
      suggestions: clean(t.suggestions),
      tester_org: t.testerOrg?.trim() || null,
      planned_for: t.plannedFor ?? null,
    });
    if (error) {
      if (error.code === "23503") return Response.json({ error: "Nie znaleziono tego rozwiązania" }, { status: 404 });
      throw error;
    }
    return Response.json({ ok: true, gmina: gmina.nazwa });
  } catch (e) {
    console.error("[tests]", e);
    return Response.json({ error: "Nie udało się zapisać" }, { status: 500 });
  }
}
