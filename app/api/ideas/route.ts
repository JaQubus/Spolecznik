import { reindexCard } from "@/lib/index-card";
import { newAccessKey, rememberNeed } from "@/lib/need-access";
import { notify } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { IdeaRequest, type IdeaResponse } from "@/lib/schemas";
import { newStatusCode } from "@/lib/status-code";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Zgłoszenie pomysłu z Pracowni: kod SPL-… z kluczem (lib/need-access.ts), indeksacja (sprawdzanie nowości, dopasowania) i powiadomienie ROPS. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "ideas", 5);
  if (limited) return limited;
  const parsed = IdeaRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Uzupełnij krótki opis pomysłu", issues: parsed.error.issues }, { status: 400 });
  }
  const { fiszka, canvas, needCode, poster } = parsed.data;
  const supabase = createAdminClient();

  try {
    // Zalogowany autor widzi swój pomysł w panelu; bez konta wystarcza kod zgłoszenia.
    const author = await createClient()
      .then((s) => s.auth.getUser())
      .then(({ data }) => data.user?.id ?? null)
      .catch(() => null);

    let needId: string | null = null;
    if (needCode) {
      const { data, error } = await supabase.from("needs").select("id").eq("status_code", needCode).maybeSingle();
      if (error) throw error;
      needId = data?.id ?? null;
    }

    // Ponowienie przy kolizji kodu, jak w lib/match.ts.
    const access = newAccessKey();
    let idea: { id: string; status_code: string } | null = null;
    let withPoster = !!poster;
    for (let attempt = 0; attempt < 3 && !idea; attempt++) {
      const { data, error } = await supabase
        .from("ideas")
        .insert({
          status_code: newStatusCode(),
          author_id: author,
          need_id: needId,
          fiszka,
          canvas,
          stage: fiszka.etap || null,
          access_hash: access.hash,
          ...(withPoster && { poster }),
        })
        .select("id, status_code")
        .single();
      // Bez migracji 0019 nie ma kolumny poster — pomysł zapisujemy bez plakatu, zamiast go odrzucić.
      if (error?.code === "PGRST204" && withPoster) {
        console.error("[ideas] brak kolumny poster (migracja 0019), zapisuję bez plakatu");
        withPoster = false;
        continue;
      }
      if (error && error.code !== "23505") throw error;
      idea = data;
    }
    if (!idea) throw new Error("Nie udało się nadać kodu zgłoszenia");

    // Indeks i powiadomienie nie mogą zablokować potwierdzenia dla autora.
    const sideEffects = await Promise.allSettled([
      reindexCard("pomysl", idea.id),
      notify({
        role: "admin",
        kind: "nowy_pomysl",
        payload: { ideaId: idea.id, statusCode: idea.status_code, title: fiszka.krotki_opis },
      }),
    ]);
    for (const r of sideEffects) if (r.status === "rejected") console.error("[ideas] efekt uboczny:", r.reason);

    // Ta przeglądarka zapamiętuje pomysł — /status pokaże go bez wpisywania kodu.
    await rememberNeed(idea.status_code, access.key);
    return Response.json({ ideaId: idea.id, statusCode: idea.status_code, accessKey: access.key } satisfies IdeaResponse);
  } catch (e) {
    console.error("[ideas]", e);
    return Response.json({ error: "Nie udało się zapisać pomysłu" }, { status: 500 });
  }
}
