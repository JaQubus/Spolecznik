import { findGmina } from "@/lib/gminy";
import { currentUserId } from "@/lib/initiatives/access";
import { notify } from "@/lib/notifications";
import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { AdoptionRequest } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * „Wypróbowaliśmy u nas”: zapowiedź przeniesienia albo ocena po nim. Liczniki na karcie inicjatywy i rozwiązania
 * odświeża trigger (0005_analytics.sql); udane przeniesienie podnosi też ocenę przenaszalności na radarze.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "adoptions", 5);
  if (limited) return limited;
  const parsed = AdoptionRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const t = parsed.data;

  try {
    const gmina = await findGmina(t.gmina, t.teryt);
    if (!gmina) return Response.json({ error: "Nie znaleźliśmy gminy o tej nazwie" }, { status: 404 });

    const supabase = createAdminClient();
    // Inicjatywę można przenieść dopiero po publikacji — wcześniej nikt poza autorem i zespołem jej nie widzi.
    if (t.initiativeId) {
      const { data } = await supabase.from("public_initiatives").select("id").eq("id", t.initiativeId).maybeSingle();
      if (!data) return Response.json({ error: "Nie znaleziono tej inicjatywy" }, { status: 404 });
    }

    const clean = (s?: string) => (s?.trim() ? anonymize(s.trim()).text : null);
    const { data: saved, error } = await supabase.from("adoptions").insert({
      initiative_id: t.initiativeId ?? null,
      pattern_id: t.patternId ?? null,
      tester_id: await currentUserId(),
      teryt: gmina.teryt,
      status: t.status,
      rating: t.status === "zakonczony" ? t.rating : null,
      worked: clean(t.worked),
      improve: clean(t.improve),
      adopter_org: clean(t.adopterOrg),
      planned_for: t.plannedFor ?? null,
      contact_email: t.contactEmail ?? null,
    }).select("id, initiatives(title), patterns(title)").single();
    if (error) {
      if (error.code === "23503") return Response.json({ error: "Nie znaleziono tej pozycji" }, { status: 404 });
      throw error;
    }

    // Dzwonek admina (Panel → Adopcje). Błąd powiadomienia nie może zablokować potwierdzenia.
    const title = (saved.initiatives as unknown as { title: string } | null)?.title
      ?? (saved.patterns as unknown as { title: string } | null)?.title ?? null;
    await notify({
      role: "admin",
      kind: "nowa_adopcja",
      payload: {
        adoptionId: saved.id,
        initiativeId: t.initiativeId ?? null,
        patternId: t.patternId ?? null,
        title,
        gmina: gmina.nazwa,
        status: t.status,
        rating: t.status === "zakonczony" ? t.rating : null,
      },
    }).catch((e) => console.error("[adoptions] powiadomienie:", e));
    return Response.json({ ok: true, gmina: gmina.nazwa });
  } catch (e) {
    console.error("[adoptions]", e);
    return Response.json({ error: "Nie udało się zapisać" }, { status: 500 });
  }
}
