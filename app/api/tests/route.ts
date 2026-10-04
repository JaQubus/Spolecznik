import { findGmina } from "@/lib/gminy";
import { anonymize } from "@/lib/pii";
import { notify } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { TestRequest } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Próba: „Chcę przetestować” albo ocena po teście. Liczniki na karcie innowacji odświeża trigger (0004).
 * Admin dostaje powiadomienie w dzwonku i widzi zgłoszenie w Panelu → Testy (#59).
 */
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
    const supabase = createAdminClient();
    const { data: test, error } = await supabase.from("tests").insert({
      innovation_id: t.innovationId,
      tester_id: tester,
      teryt: gmina.teryt,
      status: t.status,
      rating: t.status === "zakonczony" ? t.rating : null,
      feedback: clean(t.feedback),
      suggestions: clean(t.suggestions),
      tester_org: t.testerOrg?.trim() || null,
      planned_for: t.plannedFor ?? null,
    }).select("id, innovations(title)").single();
    if (error) {
      if (error.code === "23503") return Response.json({ error: "Nie znaleziono tego rozwiązania" }, { status: 404 });
      throw error;
    }

    // Powiadomienie nie może zablokować potwierdzenia dla testera.
    const innovation = test.innovations as unknown as { title: string } | null;
    await notify({
      role: "admin",
      kind: "nowy_test",
      payload: { testId: test.id, innovationId: t.innovationId, title: innovation?.title ?? null, gmina: gmina.nazwa, status: t.status },
    }).catch((e) => console.error("[tests] powiadomienie:", e));
    return Response.json({ ok: true, gmina: gmina.nazwa });
  } catch (e) {
    console.error("[tests]", e);
    return Response.json({ error: "Nie udało się zapisać" }, { status: 500 });
  }
}
