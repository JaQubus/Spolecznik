import canvasSchema from "@/data/out/canvas_schema.json";
import { STATUS_CODE, type Fiszka } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { GROUP_LABELS } from "@/lib/taxonomy";
import type { ActiveCall } from "./application-draft";
import { IdeaWorkshop, type CanvasField } from "./idea-workshop";

export const metadata = { title: "Zgłoś pomysł" };

/** Pomysł z luki (/pomysl?potrzeba=SPL-…): fiszka wstępnie wypełniona z karty potrzeby. */
async function prefillFromNeed(code: string): Promise<Partial<Fiszka>> {
  const { data } = await createAdminClient().from("needs").select("card").eq("status_code", code).maybeSingle();
  const card = data?.card as { summary?: string; groups?: string[] } | undefined;
  if (!card) return {};
  return {
    problem: card.summary ?? "",
    dla_kogo: (card.groups ?? []).map((g) => GROUP_LABELS[g as keyof typeof GROUP_LABELS]).filter(Boolean).join(", "),
  };
}

async function activeCalls(): Promise<ActiveCall[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await createAdminClient()
    .from("calls")
    .select("id, title, closes_at")
    .eq("active", true)
    .or(`opens_at.is.null,opens_at.lte.${today}`)
    .or(`closes_at.is.null,closes_at.gte.${today}`)
    .order("closes_at");
  return (data ?? []).map((c) => ({ id: c.id, title: c.title, closesAt: c.closes_at }));
}

export default async function Page(props: PageProps<"/pomysl">) {
  const params = await props.searchParams;
  const raw = typeof params.potrzeba === "string" ? params.potrzeba.trim().toUpperCase() : "";
  const needCode = STATUS_CODE.test(raw) ? raw : undefined;

  // Bez bazy formularz i tak działa — tylko bez podpowiedzi z luki i bez generatora wniosków.
  const [initial, calls] = await Promise.all([
    needCode ? prefillFromNeed(needCode).catch(() => ({})) : Promise.resolve({}),
    activeCalls().catch(() => []),
  ]);

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Zgłoś pomysł</h1>
        <p className="max-w-2xl text-lg">
          {needCode
            ? "Dla tego problemu nie ma jeszcze gotowego rozwiązania. Opisz, jak można by go rozwiązać — część fiszki uzupełniliśmy za Ciebie."
            : "Masz pomysł, jak pomóc ludziom w swojej okolicy? Opisz go krótko. Nie podawaj nazwisk, telefonów ani adresów."}
        </p>
      </div>
      <IdeaWorkshop
        initial={initial}
        needCode={needCode}
        canvasFields={canvasSchema.fields as CanvasField[]}
        calls={calls}
      />
    </section>
  );
}
