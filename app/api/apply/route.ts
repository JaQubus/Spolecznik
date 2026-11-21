import { draftApplication } from "@/lib/llm";
import { parseCallFields } from "@/lib/call-schema";
import { todayInPoland } from "@/lib/pl";
import { anonymize } from "@/lib/pii";
import { ApplyRequest } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { aiErrorResponse } from "@/lib/groq";

/** Generator wniosków: tylko przy aktywnym programie. Szkic zapisujemy w applications. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "apply", 3);
  if (limited) return limited;
  const parsed = ApplyRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { initiativeId, programId } = parsed.data;
  const supabase = createAdminClient();

  try {
    const [initiative, program] = await Promise.all([
      supabase.from("initiatives").select("id, card, canvas").eq("id", initiativeId).maybeSingle(),
      supabase.from("programs").select("id, title, description, active, opens_at, closes_at, criteria, form_schema").eq("id", programId).maybeSingle(),
    ]);
    if (initiative.error) throw initiative.error;
    if (program.error) throw program.error;
    if (!initiative.data) return Response.json({ error: "Nie znaleziono inicjatywy" }, { status: 404 });
    if (!program.data) return Response.json({ error: "Nie znaleziono programu" }, { status: 404 });
    const today = todayInPoland();
    const outsideWindow =
      (program.data.opens_at && program.data.opens_at > today) ||
      (program.data.closes_at && program.data.closes_at < today);
    if (!program.data.active || outsideWindow) return Response.json({ error: "Ten program nie przyjmuje teraz wniosków" }, { status: 409 });

    const fields = parseCallFields(program.data.form_schema);
    const draft = await draftApplication({
      program: { title: program.data.title, description: program.data.description },
      fields: fields.map(({ key, label }) => ({ field: key, label })),
      criteria: program.data.criteria,
      initiative: anonymize(JSON.stringify(initiative.data.card)).text,
      canvas: anonymize(JSON.stringify(initiative.data.canvas)).text,
    });

    const { data: application, error } = await supabase
      .from("applications")
      .insert({ initiative_id: initiativeId, program_id: programId, draft, status: "szkic" })
      .select("id")
      .single();
    if (error) throw error;
    return Response.json({ applicationId: application.id, draft });
  } catch (e) {
    return aiErrorResponse("apply", e, "Nie udało się przygotować szkicu wniosku");
  }
}
