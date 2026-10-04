import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageList } from "@/components/rozmowa/message-list";
import { isAssigned, requireExpert } from "@/lib/expert";
import { NEED_STATUS_LABELS } from "@/lib/need-status";
import { anonymize } from "@/lib/pii";
import { STATUS_CODE } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { AREA_LABELS, GROUP_LABELS } from "@/lib/taxonomy";
import { needThread } from "@/lib/threads";
import { ReplyForm } from "./reply-form";
import { ThreadLive } from "./thread-live";

export const metadata = { title: "Zgłoszenie · Ekspert" };

type Card = { summary?: string; areas?: string[]; groups?: string[]; alreadyTried?: string | null };
type Fiszka = { krotki_opis?: string; problem?: string; istota?: string; dla_kogo?: string };

/** Zgłoszenie albo pomysł przypisany do eksperta: zanonimizowany opis (bez raw_text), rozmowa i odpowiedź. */
export default async function Page(props: PageProps<"/ekspert/[kod]">) {
  const code = decodeURIComponent((await props.params).kod).toUpperCase();
  const { expert } = await requireExpert(`/ekspert/${code}`);
  if (!STATUS_CODE.test(code)) notFound();
  const thread = await needThread({ code });
  // Nieprzypisane wygląda jak nieistniejące: ekspert nie dowie się, jakie kody są w bazie.
  if (!isAssigned(thread, expert)) notFound();

  const db = createAdminClient();
  const { data, error } = thread.kind === "potrzeba"
    ? await db.from("needs").select("card, gminy(nazwa)").eq("id", thread.id).maybeSingle()
    : await db.from("ideas").select("fiszka").eq("id", thread.id).maybeSingle();
  if (error) throw error;
  const card = (data as { card?: Card } | null)?.card;
  const fiszka = (data as { fiszka?: Fiszka } | null)?.fiszka;
  const gmina = (data as { gminy?: { nazwa: string } | null } | null)?.gminy?.nazwa ?? null;
  const safe = (s: string | null | undefined) => (s ? anonymize(s).text : "");

  return (
    <article className="space-y-10">
      <p>
        <Link href="/ekspert" className="inline-flex min-h-12 items-center gap-2 font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
          <ArrowLeftIcon aria-hidden className="size-5" /> Wszystkie zgłoszenia do pomocy
        </Link>
      </p>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{thread.kind === "pomysl" ? "Pomysł" : "Zgłoszenie"} {thread.code}</h1>
        <p className="text-lg text-muted-foreground">
          Status: {NEED_STATUS_LABELS[thread.status]}{gmina && ` · gmina ${gmina}`}
        </p>
      </header>

      <section aria-labelledby="opis" className="max-w-3xl space-y-4">
        <h2 id="opis" className="text-2xl font-bold">{thread.kind === "pomysl" ? "Pomysł" : "Problem"}</h2>
        {card && (
          <>
            <p className="text-lg">{safe(card.summary)}</p>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
              {!!card.areas?.length && (<><dt className="font-bold">Obszary</dt><dd>{card.areas.map((a) => AREA_LABELS[a as keyof typeof AREA_LABELS] ?? a).join(", ")}</dd></>)}
              {!!card.groups?.length && (<><dt className="font-bold">Dla kogo</dt><dd>{card.groups.map((g) => GROUP_LABELS[g as keyof typeof GROUP_LABELS] ?? g).join(", ")}</dd></>)}
              {card.alreadyTried && (<><dt className="font-bold">Co już próbowali</dt><dd>{safe(card.alreadyTried)}</dd></>)}
            </dl>
          </>
        )}
        {fiszka && (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
            <dt className="font-bold">W skrócie</dt><dd>{safe(fiszka.krotki_opis)}</dd>
            {fiszka.problem && (<><dt className="font-bold">Problem</dt><dd className="whitespace-pre-line">{safe(fiszka.problem)}</dd></>)}
            {fiszka.istota && (<><dt className="font-bold">Na czym polega</dt><dd className="whitespace-pre-line">{safe(fiszka.istota)}</dd></>)}
            {fiszka.dla_kogo && (<><dt className="font-bold">Dla kogo</dt><dd>{safe(fiszka.dla_kogo)}</dd></>)}
          </dl>
        )}
        <p className="text-base text-muted-foreground">Dane osobowe w opisie są zamaskowane. Pełnej treści zgłoszenia nie widzi nikt poza ROPS.</p>
      </section>

      <section aria-labelledby="rozmowa" className="space-y-4">
        <h2 id="rozmowa" className="text-2xl font-bold">Rozmowa z autorem</h2>
        <ThreadLive threadId={thread.threadId} />
        <MessageList messages={thread.messages} own="ekspert" empty="Nikt jeszcze nie napisał. Twoja wiadomość będzie pierwsza." />
        {thread.status === "zamkniete"
          ? <p className="text-muted-foreground">Zgłoszenie jest zamknięte — w rozmowie nie można już pisać.</p>
          : <ReplyForm code={thread.code} name={expert!.name} />}
      </section>
    </article>
  );
}
