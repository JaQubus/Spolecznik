import { ManualApplicationDraftRequest } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

/** Persists the manual grant application draft; the browser cache is only a UX fallback. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "manual-application-draft", 30);
  if (limited) return limited;
  const parsed = ManualApplicationDraftRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nieprawidłowe dane szkicu" }, { status: 400 });

  const { applicationId, callId, draft, step, reached } = parsed.data;
  try {
    const supabase = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("id, active, opens_at, closes_at")
      .eq("id", callId)
      .maybeSingle();
    if (callError) throw callError;
    if (!call) return Response.json({ error: "Nie znaleziono naboru" }, { status: 404 });
    if (!call.active || (call.opens_at && call.opens_at > today) || (call.closes_at && call.closes_at < today)) {
      return Response.json({ error: "Ten nabór nie jest aktywny" }, { status: 409 });
    }

    const query = applicationId
      ? supabase.from("applications").update({ draft: { app: draft, step, reached } }).eq("id", applicationId).eq("call_id", callId)
      : supabase.from("applications").insert({ idea_id: null, call_id: callId, draft: { app: draft, step, reached }, status: "szkic" });
    const { data, error } = await query.select("id").single();
    if (error) throw error;
    return Response.json({ applicationId: data.id });
  } catch (error) {
    console.error("[wniosek/draft]", error);
    return Response.json({ error: "Nie udało się zapisać szkicu" }, { status: 500 });
  }
}
