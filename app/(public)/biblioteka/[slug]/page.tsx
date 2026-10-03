import { ArrowLeftIcon, ArrowTopRightOnSquareIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { NoDatabase } from "@/components/layout/no-database";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInnovation } from "@/lib/innovations";
import { formatNumber, plural } from "@/lib/pl";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { GROUP_LABELS } from "@/lib/taxonomy";
import { ICON_LINK as linkClass, isGroup, safeDecode } from "../shared";
import { LiteVideo } from "./video";

const load = cache(getInnovation);

export async function generateMetadata(props: PageProps<"/biblioteka/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const innovation = isSupabaseConfigured() ? await load(safeDecode(slug)) : null;
  return { title: innovation?.title ?? "Nie znaleziono rozwiązania" };
}


/** Krok historii: numer w kółku (ozdoba), nagłówek, treść. Numer czyta czytnik z <ol>. */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[3rem_1fr] gap-x-4 border-b py-8 first:pt-0 last:border-b-0">
      <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-foreground text-xl font-bold text-background">{n}</span>
      <div className="min-w-0 space-y-3">
        <h2 className="pt-2 text-2xl font-bold">{title}</h2>
        {children}
      </div>
    </li>
  );
}

function Text({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <div className="max-w-[68ch] space-y-3">
      {children.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: string | null }) {
  if (!children) return null;
  return (
    <div className="max-w-[68ch] space-y-1">
      <h3 className="font-bold">{label}</h3>
      <p>{children}</p>
    </div>
  );
}

export default async function Page(props: PageProps<"/biblioteka/[slug]">) {
  const { slug } = await props.params;
  if (!isSupabaseConfigured()) return <NoDatabase />;
  const i = await load(safeDecode(slug));
  if (!i) notFound();

  const groups = i.target_groups.filter(isGroup);
  const missing = <p className="text-muted-foreground">Karta tej innowacji nie opisuje jeszcze tego kroku.</p>;

  return (
    <article className="space-y-10">
      <p>
        <Link href="/biblioteka#innowacje" className={linkClass}>
          <ArrowLeftIcon aria-hidden className="size-5" /> Wróć do biblioteki
        </Link>
      </p>

      <header className="space-y-4">
        {groups.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Dla kogo">
            {groups.slice(0, 3).map((g) => <li key={g}><Badge>{GROUP_LABELS[g]}</Badge></li>)}
          </ul>
        )}
        <h1 className="text-4xl font-bold break-words hyphens-auto">{i.title}</h1>
        {i.synthetic && (
          <p className="text-base text-muted-foreground">Przykładowe dane do pokazu, nie prawdziwa innowacja z Biblioteki ROPS.</p>
        )}
      </header>

      {/* Tekst łatwy do czytania: zawsze, gdy jest. */}
      {i.etr_summary && (
        <section aria-labelledby="w-skrocie" className="max-w-[44rem] space-y-2 rounded-[16px] bg-secondary px-5 py-4">
          <h2 id="w-skrocie" className="text-xl font-bold">W skrócie, prostym językiem</h2>
          <p className="text-lg">{i.etr_summary}</p>
        </section>
      )}

      {i.video_url && (
        <section aria-labelledby="film" className="space-y-3">
          <h2 id="film" className="text-2xl font-bold">Film</h2>
          <LiteVideo url={i.video_url} title={i.title} />
        </section>
      )}

      <ol aria-label="Historia w czterech krokach" className="max-w-3xl">
        <Step n={1} title="Problem">
          {i.problem || i.beneficiaries ? (
            <>
              <Text>{i.problem}</Text>
              <Labeled label="Kogo dotyczy">{i.beneficiaries}</Labeled>
            </>
          ) : missing}
        </Step>
        <Step n={2} title="Rozwiązanie">
          {i.solution || i.components ? (
            <>
              <Text>{i.solution}</Text>
              <Labeled label="Z czego się składa">{i.components}</Labeled>
            </>
          ) : missing}
        </Step>
        <Step n={3} title="Skąd wiemy, że działa">
          {i.evidence ? <Text>{i.evidence}</Text> : missing}
          <p className="max-w-[68ch]">
            {i.tests_count > 0
              ? `W Społeczniku przetestowano je ${i.tests_count} ${plural(i.tests_count, "raz", "razy", "razy")}${i.avg_rating != null ? `, średnia ocena ${formatNumber(Number(i.avg_rating))} na 5` : ""}.`
              : "Nikt jeszcze nie opisał tu swojego testu."}
          </p>
        </Step>
        <Step n={4} title="Jak skorzystać">
          {i.how_to_use || i.who_can_use ? (
            <>
              <Text>{i.how_to_use}</Text>
              <Labeled label="Kto może to wdrożyć">{i.who_can_use}</Labeled>
            </>
          ) : missing}
        </Step>
      </ol>

      <section aria-labelledby="co-dalej" className="space-y-4">
        <h2 id="co-dalej" className="text-2xl font-bold">Co dalej?</h2>
        {/* Na wąskim ekranie przy większym tekście przyciski zawijają tekst zamiast wychodzić poza ekran. */}
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center [&>a]:h-auto [&>a]:min-h-14 [&>a]:py-3 [&>a]:text-center [&>a]:whitespace-normal">
          <Button asChild><Link href={`/wdrozenie?innowacja=${i.id}`}>Jak to wdrożyć u nas?</Link></Button>
          <Button asChild variant="outline"><Link href={`/przetestuj?innowacja=${i.id}`}>Chcę przetestować</Link></Button>
          <Button asChild variant="link"><Link href={`/zapytaj?innowacja=${i.id}`}>Zapytaj eksperta</Link></Button>
        </div>
      </section>

      {(i.source_url || i.pdf_url) && (
        <section aria-labelledby="zrodla" className="space-y-3">
          <h2 id="zrodla" className="text-xl font-bold">Źródła</h2>
          <ul className="space-y-2">
            {i.source_url && (
              <li><a href={i.source_url} className={linkClass}><ArrowTopRightOnSquareIcon aria-hidden className="size-5" /> Opis w Bibliotece Innowacji ROPS</a></li>
            )}
            {i.pdf_url && (
              <li><a href={i.pdf_url} className={linkClass}><DocumentTextIcon aria-hidden className="size-5" /> Karta innowacji (PDF)</a></li>
            )}
          </ul>
          {i.synthetic && (
            <Alert>
              <p>To przykładowe dane, więc odnośniki prowadzą do strony zastępczej.</p>
            </Alert>
          )}
        </section>
      )}
    </article>
  );
}
