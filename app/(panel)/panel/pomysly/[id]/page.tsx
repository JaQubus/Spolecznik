import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { IdeaPoster } from "@/components/pomysl/idea-poster";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { requireAdmin } from "@/lib/auth";
import { NEED_STATUS_LABELS, type NeedStatus } from "@/lib/need-status";
import { needHistory, needNeighbours, type AuditRow } from "@/lib/panel/needs";
import { formatDate } from "@/lib/pl";
import { IdeaPoster as PosterSchema, NEED_STATUSES, type Fiszka } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { needThread } from "@/lib/threads";
import { ActionForm, DeleteForm, SubmitButton } from "../../action-form";
import { assignIdeaExpert, updateIdeaStatus } from "../../actions";
import { ThreadSection } from "../../thread-section";

export const metadata = { title: "Pomysł · Panel ROPS" };

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

type IdeaRow = {
  id: string;
  status_code: string;
  created_at: string;
  status: NeedStatus;
  synthetic: boolean;
  fiszka: Partial<Fiszka>;
  needs: { id: string; status_code: string } | null;
};

const FISZKA_FIELDS = [
  ["problem", "Jaki problem rozwiązuje"],
  ["istota", "Na czym polega"],
  ["dla_kogo", "Dla kogo"],
  ["etap", "Etap"],
] as const;

export default async function Page(props: PageProps<"/panel/pomysly/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ideas")
    .select("id, status_code, created_at, status, synthetic, fiszka, needs(id, status_code)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const idea = data as unknown as IdeaRow;

  // Słowa kluczowe pomysłu są w indeksie (lib/index-card.ts) — z nich podpowiedzi ekspertów, jak przy potrzebach.
  const { data: indexed } = await supabase.from("search_index").select("lemmas").eq("kind", "pomysl").eq("ref_id", id).maybeSingle();
  const keywords = ((indexed?.lemmas as string | undefined) ?? "").split(/\s+/).filter(Boolean);

  const [history, experts, thread, poster] = await Promise.all([
    needHistory(id, "idea"),
    needNeighbours({ id, card: { keywords } }, "ekspert", 3).catch((e) => { console.error("[panel] eksperci pomysłu:", e); return []; }),
    // Bez migracji 0011 reszta strony ma działać dalej.
    needThread({ kind: "pomysl", id }).catch((e) => { console.error("[panel] rozmowa:", e); return null; }),
    ideaPoster(id),
  ]);

  const fiszka = idea.fiszka;
  const assigned = thread?.expert ?? null;
  // Jeden zielony przycisk na widok: przypisanie eksperta, a gdy nie ma kogo przypisać — zapis statusu.
  const canAssign = idea.status !== "ekspert" && experts.length > 0;

  return (
    <article className="max-w-4xl space-y-10">
      <div className="space-y-3">
        <Link href="/panel/pomysly" className={`inline-flex min-h-12 items-center gap-2 text-lg font-bold ${linkClass}`}>
          <ArrowLeftIcon aria-hidden className="size-5" /> Wszystkie pomysły
        </Link>
        <h1 className="text-3xl font-bold">Pomysł <span className="font-mono tracking-wider">{idea.status_code}</span></h1>
        <p className="text-muted-foreground">
          {formatDate(idea.created_at)}
          {" · "}<strong className="text-foreground">{NEED_STATUS_LABELS[idea.status]}</strong>
          {idea.synthetic && " · dane syntetyczne"}
          {idea.needs && (
            <>
              {" · "}odpowiada na zgłoszenie{" "}
              <Link href={`/panel/zgloszenia/${idea.needs.id}`} className={`font-mono tracking-wider ${linkClass}`}>{idea.needs.status_code}</Link>
            </>
          )}
        </p>
      </div>

      <section aria-labelledby="fiszka" className="space-y-4">
        <h2 id="fiszka" className="text-2xl font-bold">Fiszka pomysłu</h2>
        <p className="max-w-[68ch] text-lg">{fiszka.krotki_opis || "Brak opisu."}</p>
        <dl className="max-w-[68ch] space-y-3">
          {FISZKA_FIELDS.filter(([key]) => fiszka[key]).map(([key, label]) => (
            <div key={key}>
              <dt className="font-bold">{label}</dt>
              <dd className="whitespace-pre-wrap">{fiszka[key]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {poster && (
        <section aria-labelledby="plakat" className="space-y-4">
          <h2 id="plakat" className="text-2xl font-bold">Plakat pomysłu</h2>
          <p className="max-w-[68ch] text-muted-foreground">Autor wygenerował go w Pracowni z fiszki przed zgłoszeniem.</p>
          <IdeaPoster poster={poster} />
        </section>
      )}

      <section aria-labelledby="ekspert" className="space-y-3">
        <h2 id="ekspert" className="text-2xl font-bold">Ekspert</h2>
        {assigned && <p>Ekspert w rozmowie: <strong>{assigned.name}</strong></p>}
        {experts.length === 0 ? (
          <p className="text-muted-foreground">Brak sugestii — słowa kluczowe pomysłu nie pasują do żadnego eksperta.</p>
        ) : (
          <ul className="border-t">
            {experts.map((e, i) => (
              <li key={e.ref_id} className="flex flex-wrap items-center justify-between gap-3 border-b py-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-bold">{e.title}{i === 0 && " (najlepiej pasuje)"}</p>
                  <p className="line-clamp-2 text-muted-foreground">{e.body}</p>
                  <p className="text-base text-muted-foreground">Zgodność słów kluczowych {Math.round(e.similarity * 100)} na 100</p>
                </div>
                {e.ref_id !== assigned?.id && (
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

      <ThreadSection kind="pomysl" id={idea.id} thread={thread} closed={idea.status === "zamkniete"} />

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

      <section aria-labelledby="historia" className="space-y-3">
        <h2 id="historia" className="text-2xl font-bold">Historia zmian</h2>
        {history.length === 0 ? (
          <p className="text-muted-foreground">Nikt jeszcze nie zmieniał tego pomysłu.</p>
        ) : (
          <ol className="border-t">
            {history.map((h, i) => (
              <li key={i} className="border-b py-3">
                <span className="text-muted-foreground">{formatDate(h.created_at)}</span> · {describeChange(h)}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="usun" className="max-w-2xl space-y-3 border-t pt-8">
        <h2 id="usun" className="text-2xl font-bold">Usuń pomysł</h2>
        <DeleteForm
          entity="idea"
          id={idea.id}
          label={`pomysł ${idea.status_code}`}
          consequence={
            <>
              Znikną też rozmowa i szkice wniosków, a kod <span className="font-mono tracking-wider">{idea.status_code}</span>{" "}
              przestanie działać. Używaj do pomysłów testowych i spamu — prawdziwy pomysł lepiej zamknąć.
            </>
          }
        />
      </section>
    </article>
  );
}

/** Plakat z Pracowni (migracja 0021). Bez kolumny albo z uszkodzoną treścią strona działa dalej bez plakatu. */
async function ideaPoster(id: string) {
  const { data, error } = await createAdminClient().from("ideas").select("poster").eq("id", id).maybeSingle();
  if (error) {
    console.error("[panel] plakat pomysłu:", error);
    return null;
  }
  const parsed = PosterSchema.safeParse(data?.poster);
  return parsed.success ? parsed.data : null;
}

function describeChange(h: AuditRow): string {
  const d = h.diff ?? {};
  const to = d.to as NeedStatus | undefined;
  const note = d.note ? ` — „${d.note}”` : "";
  if (to) return `Status: ${NEED_STATUS_LABELS[to]}${note}`;
  return h.action;
}
