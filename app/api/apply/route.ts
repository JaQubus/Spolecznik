import { z } from "zod";
import { draftApplication } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { ApplyRequest } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

// Pola merytoryczne formularza IWS 2.0 (dane/mock/wnioski_mock.json). Pomijamy 2 (dane pomysłodawcy)
// i 12 (oświadczenia) — tych nie pisze model.
const IWS_FIELDS = [
  { field: "1_tytul", label: "1. Tytuł innowacji" },
  { field: "3_opis_innowacji", label: "3. Opis innowacji" },
  { field: "4_innowacyjnosc", label: "4. Na czym polega innowacyjność" },
  { field: "5_diagnoza_problemu", label: "5. Diagnoza problemu" },
  { field: "6_odbiorcy", label: "6. Odbiorcy" },
  { field: "7_zmiana", label: "7. Jaką zmianę wprowadzi innowacja" },
  { field: "8_wizja_przyszlosci", label: "8. Wizja przyszłości" },
  { field: "9_plan_dzialania", label: "9. Plan działania" },
  { field: "10_wnioskowana_kwota_grantu", label: "10. Wnioskowana kwota grantu" },
  { field: "11_zespol_projektowy", label: "11. Zespół projektowy" },
];

const FormSchema = z.object({
  fields: z.array(z.object({ field: z.string(), label: z.string() })).min(1),
});

/** Generator wniosków: tylko przy aktywnym naborze. Szkic zapisujemy w applications. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "apply", 3);
  if (limited) return limited;
  const parsed = ApplyRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { ideaId, callId } = parsed.data;
  const supabase = createAdminClient();

  try {
    const [idea, call] = await Promise.all([
      supabase.from("ideas").select("id, fiszka, canvas").eq("id", ideaId).maybeSingle(),
      supabase.from("calls").select("id, title, description, active, criteria, form_schema").eq("id", callId).maybeSingle(),
    ]);
    if (idea.error) throw idea.error;
    if (call.error) throw call.error;
    if (!idea.data) return Response.json({ error: "Nie znaleziono pomysłu" }, { status: 404 });
    if (!call.data) return Response.json({ error: "Nie znaleziono naboru" }, { status: 404 });
    if (!call.data.active) return Response.json({ error: "Ten nabór nie jest aktywny" }, { status: 409 });

    const formSchema = FormSchema.safeParse(call.data.form_schema);
    const draft = await draftApplication({
      call: { title: call.data.title, description: call.data.description },
      fields: formSchema.success ? formSchema.data.fields : IWS_FIELDS,
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
    return Response.json({ error: "Nie udało się przygotować szkicu wniosku" }, { status: 500 });
  }
}
