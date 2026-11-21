import canvasSchema from "@/data/out/canvas_schema.json";
import { todayInPoland } from "@/lib/pl";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActiveProgram } from "./application-draft";
import { IdeaWorkshop, type CanvasField } from "./idea-workshop";

export const metadata = { title: "Warsztat pomysłu" };

async function activePrograms(): Promise<ActiveProgram[]> {
  const today = todayInPoland();
  const { data } = await createAdminClient()
    .from("programs")
    .select("id, title, closes_at")
    .eq("active", true)
    .or(`opens_at.is.null,opens_at.lte.${today}`)
    .or(`closes_at.is.null,closes_at.gte.${today}`)
    .order("closes_at");
  return (data ?? []).map((c) => ({ id: c.id, title: c.title, closesAt: c.closes_at }));
}

/**
 * Warsztat: dla inicjatywy, która jest jeszcze pomysłem. Szkic, asystent (sprawdza, czy coś podobnego już działa),
 * kanwa i plakat — a na końcu zwykłe zgłoszenie z kodem, jak na /zglos.
 */
export default async function Page() {
  // Bez bazy formularz i tak działa — tylko bez generatora wniosków.
  const programs = await activePrograms().catch(() => []);

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Warsztat pomysłu</h1>
        <p className="max-w-2xl text-lg">
          Masz pomysł na inicjatywę w szkole, na uczelni albo w urzędzie, ale jeszcze go nie sprawdziliście? Rozpisz go tutaj
          z pomocą asystenta. Nie podawaj nazwisk, telefonów ani adresów.
        </p>
      </div>
      <IdeaWorkshop initial={{}} canvasFields={canvasSchema.fields as CanvasField[]} programs={programs} />
    </section>
  );
}
