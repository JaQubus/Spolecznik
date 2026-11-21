import { getViewer } from "@/lib/auth";
import { findGmina, gminaFacts, gminaLabel } from "@/lib/gminy";
import { aiErrorResponse } from "@/lib/groq";
import { initiativeHref, patternHref } from "@/lib/knowledge/hrefs";
import { transferPlan, type Partner } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { RELATED_MIN_SIMILARITY, TransferRequest, type PlanDocument } from "@/lib/schemas";
import { keywordSearch } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPlan } from "@/lib/transfer-plan";

type Source = { title: string; text: string; href: string; lemmas: string[]; authorPartner: Partner | null };

/** Opis źródła dla modelu: opublikowana inicjatywa (z widoku) albo sprawdzone rozwiązanie. */
async function loadSource(kind: "initiative" | "pattern", id: string): Promise<Source | null> {
  const supabase = createAdminClient();
  const { data: indexed } = await supabase.from("search_index").select("lemmas").eq("kind", kind).eq("ref_id", id).maybeSingle();
  const indexedLemmas = ((indexed?.lemmas as string | undefined) ?? "").split(/\s+/).filter(Boolean);
  const lemmasOr = (title: string) => (indexedLemmas.length ? indexedLemmas : title.toLowerCase().split(/\s+/));

  if (kind === "initiative") {
    const { data, error } = await supabase
      .from("public_initiatives").select("id, slug, title, summary, card, municipality").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const card = (data.card ?? {}) as { problem?: string; solution?: string; effects?: string | null; beneficiaries?: string | null };
    return {
      title: data.title as string,
      href: data.slug ? initiativeHref(data.slug as string) : "/inicjatywy",
      lemmas: lemmasOr(data.title as string),
      text: [
        `Tytuł: ${data.title}`, `Streszczenie: ${data.summary}`,
        card.problem && `Problem: ${card.problem}`, card.solution && `Rozwiązanie: ${card.solution}`,
        card.effects && `Efekty: ${card.effects}`, card.beneficiaries && `Odbiorcy: ${card.beneficiaries}`,
      ].filter(Boolean).join("\n"),
      // Autor inicjatywy to naturalny partner przeniesienia — bez danych osobowych, tylko gmina.
      authorPartner: {
        id: `initiative:${data.id}`,
        name: `Autor inicjatywy${data.municipality ? ` (gmina ${data.municipality})` : ""}`,
        description: "Prowadzi tę inicjatywę i może opowiedzieć, jak ją uruchomić. Kontakt przez partnerstwo w serwisie.",
      },
    };
  }

  const { data, error } = await supabase
    .from("patterns")
    .select("id, slug, title, problem, solution, beneficiaries, who_can_use, evidence, how_to_use, components")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    title: data.title as string,
    href: patternHref((data.slug as string | null) ?? (data.id as string)),
    lemmas: lemmasOr(data.title as string),
    text: [
      `Tytuł: ${data.title}`,
      data.problem && `Problem: ${data.problem}`, data.solution && `Rozwiązanie: ${data.solution}`,
      data.beneficiaries && `Odbiorcy: ${data.beneficiaries}`, data.who_can_use && `Kto może przenieść: ${data.who_can_use}`,
      data.evidence && `Skąd wiemy, że działa: ${data.evidence}`, data.how_to_use && `Jak skorzystać: ${data.how_to_use}`,
      data.components && `Składowe: ${data.components}`,
    ].filter(Boolean).join("\n"),
    authorPartner: null,
  };
}

/**
 * „Przenieś do siebie”: inicjatywa albo rozwiązanie + fakty o gminie z BDL + dane instytucji z formularza
 * + partnerzy (autor inicjatywy i mentorzy z indeksu). Plan zapisujemy do Panelu → Przeniesienia.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "transfer", 5);
  if (limited) return limited;
  const parsed = TransferRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { sourceKind, sourceId, gmina, teryt, ...fields } = parsed.data;
  // „Dostępne osoby” to wolny tekst: idzie do modelu i do bazy, więc bez danych osobowych (lib/pii.ts).
  const input = { ...fields, staff: fields.staff ? anonymize(fields.staff).text : undefined };
  const supabase = createAdminClient();

  try {
    const [source, gminaRow] = await Promise.all([loadSource(sourceKind, sourceId), findGmina(gmina, teryt)]);
    if (!source) return Response.json({ error: "Nie znaleziono inicjatywy ani rozwiązania" }, { status: 404 });
    if (!gminaRow) return Response.json({ error: "Nie znaleziono gminy o tej nazwie" }, { status: 404 });

    const mentorHits = (await keywordSearch("mentor", source.lemmas, 5)).filter((h) => h.similarity >= RELATED_MIN_SIMILARITY);
    const { data: mentors, error: mentorsError } = mentorHits.length
      ? await supabase.from("mentors").select("id, name, bio").eq("active", true).in("id", mentorHits.map((h) => h.ref_id))
      : { data: [], error: null };
    if (mentorsError) throw mentorsError;
    const partners: Partner[] = [
      ...(source.authorPartner ? [source.authorPartner] : []),
      ...(mentors ?? []).map((m) => ({ id: m.id as string, name: m.name as string, description: m.bio as string })),
    ];

    const label = gminaLabel(gminaRow);
    const facts = gminaFacts(gminaRow);
    const raw = await transferPlan(source.text, { label, facts }, input, partners);
    const plan = checkPlan(raw, { facts, partners, budget: input.budget });

    // Zapis nie blokuje wyniku: gdy się nie uda, użytkownik i tak dostaje plan (bez id).
    const viewer = await getViewer();
    const { data: saved, error: saveError } = await supabase
      .from("transfer_plans")
      .insert({
        source_kind: sourceKind,
        source_id: sourceId,
        teryt: gminaRow.teryt,
        institution_type: input.institutionType,
        input,
        plan,
        author_id: viewer?.via === "supabase" ? viewer.id : null,
      })
      .select("id, created_at")
      .single();
    if (saveError) console.error("[transfer] zapis planu", saveError);

    const doc: PlanDocument = {
      id: saved?.id ?? null,
      createdAt: saved?.created_at ?? new Date().toISOString(),
      source: { kind: sourceKind, id: sourceId, title: source.title, href: source.href },
      gmina: { teryt: gminaRow.teryt, nazwa: gminaRow.nazwa, label },
      input,
      plan,
    };
    return Response.json(doc);
  } catch (e) {
    return aiErrorResponse("transfer", e, "Nie udało się przygotować planu przeniesienia");
  }
}
