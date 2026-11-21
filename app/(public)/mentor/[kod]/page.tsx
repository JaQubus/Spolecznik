import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageList } from "@/components/rozmowa/message-list";
import { statusLabel } from "@/lib/initiatives/status";
import { isAssigned, requireMentor } from "@/lib/mentors";
import { anonymize } from "@/lib/pii";
import { STATUS_CODE, type InitiativeCard } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { domainLabel, institutionLabel, stageLabel } from "@/lib/taxonomy";
import { initiativeThread } from "@/lib/threads";
import { ReplyForm } from "./reply-form";
import { ThreadLive } from "./thread-live";
import { org } from "@/lib/brand";

export const metadata = { title: "Inicjatywa · Mentor" };

/** Inicjatywa przypisana do mentora: zanonimizowana karta (bez raw_text), rozmowa i odpowiedź. */
export default async function Page(props: PageProps<"/mentor/[kod]">) {
  const code = decodeURIComponent((await props.params).kod).toUpperCase();
  const { mentor } = await requireMentor(`/mentor/${code}`);
  if (!STATUS_CODE.test(code)) notFound();
  const thread = await initiativeThread({ code });
  // Nieprzypisane wygląda jak nieistniejące: mentor nie dowie się, jakie kody są w bazie.
  if (!isAssigned(thread, mentor)) notFound();

  const { data, error } = await createAdminClient()
    .from("initiatives").select("card, municipalities(name)").eq("id", thread.id).maybeSingle();
  if (error) throw error;
  const card = data?.card as InitiativeCard | undefined;
  const gmina = (data?.municipalities as unknown as { name: string } | null)?.name ?? null;
  const safe = (s: string | null | undefined) => (s ? anonymize(s).text : "");

  return (
    <article className="space-y-10">
      <p>
        <Link href="/mentor" className="inline-flex min-h-12 items-center gap-2 font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
          <ArrowLeftIcon aria-hidden className="size-5" /> Wszystkie inicjatywy do wsparcia
        </Link>
      </p>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{thread.title}</h1>
        <p className="text-lg text-muted-foreground">
          <span className="font-mono">{thread.code}</span> · Status: {statusLabel(thread.status)}{gmina && ` · gmina ${gmina}`}
        </p>
      </header>

      {card && (
        <section aria-labelledby="opis" className="max-w-3xl space-y-4">
          <h2 id="opis" className="text-2xl font-bold">Inicjatywa</h2>
          <p className="text-lg">{safe(card.summary)}</p>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
            <dt className="font-bold">Problem</dt><dd className="whitespace-pre-line">{safe(card.problem)}</dd>
            <dt className="font-bold">Rozwiązanie</dt><dd className="whitespace-pre-line">{safe(card.solution)}</dd>
            {card.effects && (<><dt className="font-bold">Efekty</dt><dd className="whitespace-pre-line">{safe(card.effects)}</dd></>)}
            {card.beneficiaries && (<><dt className="font-bold">Dla kogo</dt><dd>{safe(card.beneficiaries)}</dd></>)}
            <dt className="font-bold">Dziedziny</dt><dd>{card.domains.map(domainLabel).join(", ")}</dd>
            <dt className="font-bold">Etap</dt><dd>{stageLabel(card.stage)}</dd>
            {card.institutionType && (<><dt className="font-bold">Instytucja</dt><dd>{institutionLabel(card.institutionType)}</dd></>)}
          </dl>
          <p className="text-base text-muted-foreground">Dane osobowe w opisie są zamaskowane. Pełnej treści zgłoszenia nie widzi nikt poza zespołem {org.short}.</p>
        </section>
      )}

      <section aria-labelledby="rozmowa" className="space-y-4">
        <h2 id="rozmowa" className="text-2xl font-bold">Rozmowa z autorem</h2>
        <ThreadLive threadId={thread.threadId} />
        <MessageList messages={thread.messages} own="mentor" empty="Nikt jeszcze nie napisał. Twoja wiadomość będzie pierwsza." />
        {thread.status === "archived"
          ? <p className="text-muted-foreground">Zgłoszenie jest zamknięte — w rozmowie nie można już pisać.</p>
          : <ReplyForm code={thread.code} name={mentor!.name} />}
      </section>
    </article>
  );
}
