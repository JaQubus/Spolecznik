import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import canvasSchema from "@/data/out/canvas_schema.json";
import { Alert } from "@/components/ui/alert";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { requireAdmin } from "@/lib/auth";
import { NEED_STATUS_LABELS, type NeedStatus } from "@/lib/need-status";
import { anonymize } from "@/lib/pii";
import { formatDate } from "@/lib/pl";
import { NEED_STATUSES, type Fiszka } from "@/lib/schemas";
import { keywordSearch } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportThread } from "@/lib/threads";
import { ActionForm, DeleteForm, SubmitButton } from "../../action-form";
import { assignIdeaExpert, updateIdeaStatus } from "../../actions";
import { ThreadSection } from "../../thread-section";

export const metadata = { title: "Pomysł · Panel ROPS" };

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

// Etykiety jak w formularzu Pracowni (app/(public)/pomysl/idea-workshop.tsx).
const FISZKA_LABELS: [keyof Fiszka, string][] = [
  ["problem", "Jaki problem rozwiązuje"],
  ["istota", "Na czym polega"],
  ["dla_kogo", "Dla kogo"],
  ["etap", "Etap"],
];
const CANVAS_LABELS = new Map((canvasSchema.fields as { key: string; label: string }[]).map((f) => [f.key, f.label]));

type IdeaRow = {
  id: string;
  status_code: string;
  status: NeedStatus;
  created_at: string;
  synthetic: boolean;
  fiszka: Partial<Fiszka>;
  canvas: Record<string, string>;
  needs: { id: string; status_code: string } | null;
};

/** Eksperci po słowach kluczowych pomysłu z indeksu (te same, po których działa sprawdzanie nowości). */
async function suggestedExperts(ideaId: string) {
  const { data } = await createAdminClient().from("search_index").select("lemmas").eq("kind", "pomysl").eq("ref_id", ideaId).maybeSingle();
  const lemmas = ((data?.lemmas as string | undefined) ?? "").split(/\s+/).filter(Boolean);
  return lemmas.length ? keywordSearch("ekspert", lemmas, 3) : [];
}

export default async function Page(props: PageProps<"/panel/pomysly/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ideas")
    .select("id, status_code, status, created_at, synthetic, fiszka, canvas, needs(id, status_code)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const idea = data as unknown as IdeaRow;

  const [thread, experts, drafts] = await Promise.all([
    reportThread({ kind: "pomysl", id }).catch((e) => { console.error("[panel] rozmowa o pomyśle:", e); return null; }),
    suggestedExperts(id).catch((e) => { console.error("[panel] eksperci pomysłu:", e); return []; }),
    admin.from("applications").select("id, status, created_at, calls(title)").eq("idea_id", id).order("created_at", { ascending: false }),
  ]);

  const fiszka = idea.fiszka;
  const canvas = Object.entries(idea.canvas ?? {}).filter(([, v]) => v.trim());
  const pii = anonymize([...Object.values(fiszka), ...canvas.map(([, v]) => v)].join("\n")).found;
  const closed = idea.status === "zamkniete";
  // Jeden zielony przycisk na widok: przypisanie eksperta, a gdy nie ma kogo przypisać — zapis statusu.
  const canAssign = idea.status !== "ekspert" && experts.length > 0;

  return (
    <article className="max-w-4xl space-y-10">
      <div className="space-y-3">
        <Link href="/panel/pomysly" className={`inline-flex items-center gap-2 text-lg font-bold ${linkClass}`}>
          <ArrowLeftIcon aria-hidden className="size-5" /> Wszystkie pomysły
        </Link>
        <h1 className="text-3xl font-bold">Pomysł <span className="font-mono tracking-wider">{idea.status_code}</span></h1>
        <p className="text-muted-foreground">
          {formatDate(idea.created_at)}
          {" · "}<strong className="text-foreground">{NEED_STATUS_LABELS[idea.status]}</strong>
          {idea.synthetic && " · dane syntetyczne"}
        </p>
        {idea.needs && (
          <p>
            Odpowiada na zgłoszenie bez gotowego rozwiązania:{" "}
            <Link href={`/panel/zgloszenia/${idea.needs.id}`} className={`font-mono tracking-wider ${linkClass}`}>{idea.needs.status_code}</Link>
          </p>
        )}
      </div>

      <section aria-labelledby="fiszka" className="space-y-4">
        <h2 id="fiszka" className="text-2xl font-bold">Fiszka</h2>
        <p className="max-w-[68ch] text-lg">{fiszka.krotki_opis || "Brak krótkiego opisu."}</p>
        <dl className="grid max-w-[68ch] gap-1">
          {FISZKA_LABELS.filter(([key]) => fiszka[key]?.trim()).map(([key, label]) => (
            <div key={key} className="mb-3">
              <dt className="font-bold">{label}</dt>
              <dd className="whitespace-pre-line">{fiszka[key]}</dd>
            </div>
          ))}
        </dl>
        {canvas.length > 0 && (
          <details className="max-w-[68ch] space-y-3">
            <summary className="cursor-pointer text-lg font-bold">Canvas ({canvas.length} z {CANVAS_LABELS.size} pól)</summary>
            <dl className="grid gap-1 pt-3">
              {canvas.map(([key, value]) => (
                <div key={key} className="mb-3">
                  <dt className="font-bold">{CANVAS_LABELS.get(key) ?? key}</dt>
                  <dd className="whitespace-pre-line">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
        {pii && (
          <Alert title="Może zawierać dane osobowe">
            <p>W opisie są numery, adresy e-mail albo adresy. Nie przekazuj go dalej bez sprawdzenia.</p>
          </Alert>
        )}
      </section>

      <section aria-labelledby="ekspert" className="space-y-3">
        <h2 id="ekspert" className="text-2xl font-bold">Ekspert</h2>
        {thread?.expert && <p>Przypisany ekspert: <strong>{thread.expert.name}</strong></p>}
        {experts.length === 0 ? (
          <p className="text-muted-foreground">Brak sugestii — słowa kluczowe pomysłu nie pasują do żadnego eksperta.</p>
        ) : (
          <ul className="border-t">
            {experts.map((e, i) => (
              <li key={e.ref_id} className="flex flex-wrap items-center justify-between gap-3 border-b py-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-bold">{e.title}{i === 0 && " (najlepiej pasuje)"}</p>
                  <p className="text-base text-muted-foreground">Zgodność słów kluczowych {Math.round(e.similarity * 100)} na 100</p>
                </div>
                {e.ref_id !== thread?.expert?.id && (
                  <ActionForm action={assignIdeaExpert} className="space-y-2">
                    <input type="hidden" name="ideaId" value={idea.id} />
                    <input type="hidden" name="expertId" value={e.ref_id} />
                    <SubmitButton variant={canAssign && i === 0 ? "default" : "outline"} size={canAssign && i === 0 ? "default" : "sm"} aria-label={`Przypisz eksperta: ${e.title}`}>
                      Przypisz eksperta
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ThreadSection kind="pomysl" id={idea.id} thread={thread} closed={closed} />

      <section aria-labelledby="status" className="space-y-3">
        <h2 id="status" className="text-2xl font-bold">Status</h2>
        <ActionForm action={updateIdeaStatus} className="space-y-6">
          <input type="hidden" name="ideaId" value={idea.id} />
          <fieldset className="space-y-2">
            <legend className="mb-2 text-lg font-bold">Nowy status</legend>
            <RadioGroup name="status" defaultValue={idea.status}>
              {NEED_STATUSES.filter((s) => s !== "luka").map((s) => (
                <RadioGroupOption key={s} id={`status-${s}`} value={s} label={NEED_STATUS_LABELS[s]} />
              ))}
            </RadioGroup>
          </fieldset>
          <SubmitButton variant={canAssign ? "outline" : "default"}>Zapisz status</SubmitButton>
        </ActionForm>
        <p>
          <Link href={`/status/${idea.status_code}`} className={linkClass}>Widok dla autora</Link>
        </p>
      </section>

      {(drafts.data ?? []).length > 0 && (
        <section aria-labelledby="wnioski" className="space-y-3">
          <h2 id="wnioski" className="text-2xl font-bold">Szkice wniosków</h2>
          <ul className="border-t">
            {(drafts.data ?? []).map((d) => (
              <li key={d.id} className="border-b py-3">
                {(d.calls as unknown as { title: string } | null)?.title ?? "Nabór usunięty"}
                <span className="text-muted-foreground"> · {d.status} · {formatDate(d.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="usun" className="max-w-2xl space-y-3 border-t pt-8">
        <h2 id="usun" className="text-2xl font-bold">Usuń pomysł</h2>
        <DeleteForm
          entity="idea"
          id={idea.id}
          label={`pomysł ${idea.status_code}`}
          consequence={
            <>
              Znikną też rozmowa, szkice wniosków i powiadomienia, a kod{" "}
              <span className="font-mono tracking-wider">{idea.status_code}</span> przestanie działać. Używaj do pomysłów
              testowych i spamu — prawdziwy pomysł lepiej zamknąć.
            </>
          }
        />
      </section>
    </article>
  );
}
