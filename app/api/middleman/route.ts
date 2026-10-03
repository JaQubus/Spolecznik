import { describeGmina, findGmina } from "@/lib/gminy";
import { implementationCard } from "@/lib/llm";
import { MiddlemanRequest, RELATED_MIN_SIMILARITY } from "@/lib/schemas";
import { keywordSearch } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

/** Karta wdrożeniowa: innowacja z Biblioteki + profil gminy z BDL + partnerzy z indeksu ekspertów. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "middleman", 5);
  if (limited) return limited;
  const parsed = MiddlemanRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { innovationId, gmina } = parsed.data;
  const supabase = createAdminClient();

  try {
    const [{ data: innovation, error }, gminaRow] = await Promise.all([
      supabase
        .from("innovations")
        .select("id, title, problem, solution, beneficiaries, who_can_use, evidence, how_to_use, components")
        .eq("id", innovationId)
        .maybeSingle(),
      findGmina(gmina),
    ]);
    if (error) throw error;
    if (!innovation) return Response.json({ error: "Nie znaleziono innowacji" }, { status: 404 });
    if (!gminaRow) return Response.json({ error: "Nie znaleziono gminy o tej nazwie" }, { status: 404 });

    const innovationText = [
      `Tytuł: ${innovation.title}`,
      innovation.problem && `Problem: ${innovation.problem}`,
      innovation.solution && `Rozwiązanie: ${innovation.solution}`,
      innovation.beneficiaries && `Odbiorcy: ${innovation.beneficiaries}`,
      innovation.who_can_use && `Kto może wdrożyć: ${innovation.who_can_use}`,
      innovation.evidence && `Skąd wiemy, że działa: ${innovation.evidence}`,
      innovation.how_to_use && `Jak skorzystać: ${innovation.how_to_use}`,
      innovation.components && `Składowe: ${innovation.components}`,
    ].filter(Boolean).join("\n");

    // Partnerzy: eksperci, którzy dzielą lematy z innowacją (te same, po których szuka Dopasuj).
    const { data: indexed, error: indexError } = await supabase
      .from("search_index").select("lemmas").eq("kind", "innowacja").eq("ref_id", innovationId).maybeSingle();
    if (indexError) throw indexError;
    const lemmas = ((indexed?.lemmas as string | undefined) ?? innovation.title.toLowerCase()).split(/\s+/).filter(Boolean);
    const expertHits = (await keywordSearch("ekspert", lemmas, 5))
      .filter((h) => h.similarity >= RELATED_MIN_SIMILARITY);
    const { data: experts, error: expertsError } = expertHits.length
      ? await supabase.from("search_index").select("ref_id, title, body")
          .eq("kind", "ekspert").in("ref_id", expertHits.map((h) => h.ref_id))
      : { data: [], error: null };
    if (expertsError) throw expertsError;
    const partners = (experts ?? []).map((e) => ({ id: e.ref_id as string, name: e.title as string, description: e.body as string }));

    const card = await implementationCard(innovationText, describeGmina(gminaRow), partners);
    const partnerById = new Map(partners.map((p) => [p.id, p]));
    return Response.json({
      innovation: { id: innovation.id, title: innovation.title },
      gmina: { teryt: gminaRow.teryt, nazwa: gminaRow.nazwa },
      card: {
        ...card,
        partners: card.partners.map((p) => ({ ...p, name: partnerById.get(p.id)?.name ?? "" })),
      },
    });
  } catch (e) {
    console.error("[middleman]", e);
    return Response.json({ error: "Nie udało się przygotować karty wdrożeniowej" }, { status: 500 });
  }
}
