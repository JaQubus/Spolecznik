import { getViewer } from "@/lib/auth";
import { findGmina, gminaFacts, gminaLabel } from "@/lib/gminy";
import { aiErrorResponse } from "@/lib/groq";
import { checkPlan } from "@/lib/implementation-plan";
import { implementationPlan } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { MiddlemanRequest, RELATED_MIN_SIMILARITY, type PlanDocument } from "@/lib/schemas";
import { keywordSearch } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Szkic planu wdrożenia pod nabór „Usługa Wrażliwa”: innowacja z Biblioteki + fakty o gminie z BDL
 * + dane wnioskodawcy z formularza + partnerzy z indeksu ekspertów. Plan zapisujemy do Panelu → Wdrożenia.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "middleman", 5);
  if (limited) return limited;
  const parsed = MiddlemanRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { innovationId, gmina, teryt, ...fields } = parsed.data;
  // „Kadra” to wolny tekst: idzie do modelu i do bazy, więc bez danych osobowych (lib/pii.ts), jak w innych trasach.
  const input = { ...fields, staff: fields.staff ? anonymize(fields.staff).text : undefined };
  const supabase = createAdminClient();

  try {
    const [{ data: innovation, error }, gminaRow] = await Promise.all([
      supabase
        .from("innovations")
        .select("id, title, problem, solution, beneficiaries, who_can_use, evidence, how_to_use, components")
        .eq("id", innovationId)
        .maybeSingle(),
      findGmina(gmina, teryt),
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

    const label = gminaLabel(gminaRow);
    const facts = gminaFacts(gminaRow);
    const raw = await implementationPlan(innovationText, { label, facts }, input, partners);
    const plan = checkPlan(raw, { facts, partners, budget: input.budget });

    // Zapis nie blokuje wyniku: gdy się nie uda, użytkownik i tak dostaje plan (bez id).
    const viewer = await getViewer();
    const { data: saved, error: saveError } = await supabase
      .from("implementation_plans")
      .insert({
        innovation_id: innovation.id,
        teryt: gminaRow.teryt,
        institution_type: input.institutionType,
        input,
        plan,
        author_id: viewer?.via === "supabase" ? viewer.id : null,
      })
      .select("id, created_at")
      .single();
    if (saveError) console.error("[middleman] zapis planu", saveError);

    const doc: PlanDocument = {
      id: saved?.id ?? null,
      createdAt: saved?.created_at ?? new Date().toISOString(),
      innovation: { id: innovation.id, title: innovation.title },
      gmina: { teryt: gminaRow.teryt, nazwa: gminaRow.nazwa, label },
      input,
      plan,
    };
    return Response.json(doc);
  } catch (e) {
    return aiErrorResponse("middleman", e, "Nie udało się przygotować planu wdrożenia");
  }
}
