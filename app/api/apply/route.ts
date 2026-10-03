import { draftApplication } from "@/lib/llm";
import { parseCallFormSchema } from "@/lib/call-schema";
import { anonymize } from "@/lib/pii";
import { ApplyRequest } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

/** Generator wnioskÃ³w: tylko przy aktywnym naborze. Szkic zapisujemy w applications. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "apply", 3);
  if (limited) return limited;
  const parsed = ApplyRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "NieprawidÅ‚owe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { ideaId, callId } = parsed.data;
  const supabase = createAdminClient();

  try {
    const [idea, call] = await Promise.all([
      supabase.from("ideas").select("id, fiszka, canvas").eq("id", ideaId).maybeSingle(),
      supabase.from("calls").select("id, title, description, active, opens_at, closes_at, criteria, form_schema").eq("id", callId).maybeSingle(),
    ]);
    if (idea.error) throw idea.error;
    if (call.error) throw call.error;
    if (!idea.data) return Response.json({ error: "Nie znaleziono pomysÅ‚u" }, { status: 404 });
    if (!call.data) return Response.json({ error: "Nie znaleziono naboru" }, { status: 404 });
    const today = new Date().toISOString().slice(0, 10);
    const outsideWindow =
      (call.data.opens_at && call.data.opens_at > today) ||
      (call.data.closes_at && call.data.closes_at < today);
    if (!call.data.active || outsideWindow) return Response.json({ error: "Ten nabÃ³r nie jest aktywny" }, { status: 409 });

    const formSchema = parseCallFormSchema(call.data.form_schema);
    const draft = await draftApplication({
      call: { title: call.data.title, description: call.data.description },
      fields: formSchema.fields.map(({ key, label }) => ({ field: key, label })),
      criteria: call.data.criteria,
      fiszka: anonymize(JSON.stringify(idea.data.fiszka)).text,
      canvas: anonymize(JSON.stringify(idea.data.canvas)).text,
    });

    const { data: application, error } = await supabase
      .from("applications")
      .insert({ idea_id: ideaId, call_id: callId, draft, status: "szkic" })
      .select("id")
      .single();
    if (error) throw error;
    return Response.json({ applicationId: application.id, draft });
  } catch (e) {
    console.error("[apply]", e);
    return Response.json({ error: "Nie udaÅ‚o siÄ™ przygotowaÄ‡ szkicu wniosku" }, { status: 500 });
  }
}
