import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { NEED_STATUS_LABELS, type NeedStatus } from "@/lib/need-status";
import { formatDate } from "@/lib/pl";
import { NEED_STATUSES } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm, SubmitButton } from "../action-form";
import { updateIdeaStatus } from "../actions";

export const metadata = { title: "Pomysły · Panel ROPS" };

const selectClass = "h-12 rounded-lg border-2 border-input bg-background px-3 text-base hover:border-foreground";
const linkClass = "text-base underline decoration-1 underline-offset-4 hover:decoration-2";

type IdeaRow = { id: string; status_code: string; created_at: string; fiszka: { krotki_opis?: string }; status: NeedStatus };

export default async function Page() {
  await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("ideas")
    .select("id, status_code, created_at, fiszka, status")
    .neq("status", "zamkniete")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const ideas = (data ?? []) as IdeaRow[];

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Pomysły</h1>
      {ideas.length === 0 ? (
        <p className="text-muted-foreground">Nie ma otwartych pomysłów.</p>
      ) : (
        <ol className="max-w-4xl border-t">
          {ideas.map((i) => (
            <li key={i.id} className="grid gap-3 border-b py-6">
              <p className="text-base text-muted-foreground">
                <span className="font-mono tracking-wider">{i.status_code}</span>
                {" · "}{formatDate(i.created_at)}
                {" · "}<strong className="text-foreground">{NEED_STATUS_LABELS[i.status]}</strong>
              </p>
              <p className="max-w-[68ch]">{i.fiszka.krotki_opis || "Brak opisu."}</p>
              <ActionForm action={updateIdeaStatus} className="space-y-2">
                <input type="hidden" name="ideaId" value={i.id} />
                <div className="flex flex-wrap items-end gap-3">
                  <label className="grid gap-1 text-base">
                    <span className="font-bold">Status</span>
                    <select name="status" defaultValue={i.status} className={selectClass}>
                      {NEED_STATUSES.filter((s) => s !== "luka").map((s) => (
                        <option key={s} value={s}>{NEED_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </label>
                  <SubmitButton variant="outline" size="sm" aria-label={`Zapisz status pomysłu ${i.status_code}`}>Zapisz status</SubmitButton>
                  <Link href={`/status/${i.status_code}`} className={linkClass}>Widok dla autora</Link>
                </div>
              </ActionForm>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
