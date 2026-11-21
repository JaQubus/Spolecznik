import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/knowledge/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { publicInitiativesAvailable } from "@/lib/initiatives/public";
import { institutionStats } from "@/lib/innovations/institutions";
import { getPublicInstitution, listInstitutionInnovations } from "@/lib/innovations/public-institutions";
import { initiativeHref } from "@/lib/knowledge/hrefs";
import { plural } from "@/lib/pl";
import { innovationKindLabel, institutionLabel, sectorLabel, signalLevel } from "@/lib/taxonomy";
import { safeDecode } from "../../wiedza/shared";

async function load(props: PageProps<"/instytucje/[slug]">) {
  if (!publicInitiativesAvailable()) return null;
  return getPublicInstitution(safeDecode((await props.params).slug));
}

export async function generateMetadata(props: PageProps<"/instytucje/[slug]">): Promise<Metadata> {
  const i = await load(props);
  return i ? { title: `${i.name} · Instytucje`, description: `Innowacje zgłoszone przez: ${i.name}.` } : {};
}

/** Strona instytucji: jej opublikowane innowacje i statystyki. Zachęta dla szkół i samorządów do zgłaszania. */
export default async function Page(props: PageProps<"/instytucje/[slug]">) {
  const inst = await load(props);
  if (!inst) notFound();
  const items = await listInstitutionInnovations(inst.id);
  const stats = institutionStats(items);
  const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

  return (
    <article className="space-y-12">
      <div className="space-y-4">
        <Breadcrumbs items={[{ href: "/instytucje", label: "Instytucje" }, { label: inst.name }]} />
        <h1 className="text-4xl font-bold">{inst.name}</h1>
        <p className="text-xl">
          {institutionLabel(inst.institution_type)}
          {inst.synthetic && <> · <Badge>Przykład demonstracyjny</Badge></>}
        </p>
        {inst.website && (
          <p>
            <a href={inst.website} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-12 items-center gap-2 ${linkClass}`}>
              Strona instytucji <ArrowTopRightOnSquareIcon aria-hidden className="size-5" />
              <span className="sr-only">(otwiera się w nowej karcie)</span>
            </a>
          </p>
        )}
      </div>

      <section aria-labelledby="liczby" className="space-y-4">
        <h2 id="liczby" className="text-3xl font-bold">W liczbach</h2>
        <dl className="grid max-w-[48rem] gap-x-6 gap-y-3 text-lg sm:grid-cols-[auto_1fr]">
          <dt className="font-bold">Opublikowane innowacje</dt><dd>{stats.total}</dd>
          <dt className="font-bold">Z silnym sygnałem radaru</dt><dd>{stats.strong}</dd>
          <dt className="font-bold">W realizacji lub wdrożone</dt><dd>{stats.inProgress}</dd>
          <dt className="font-bold">Wypróbowania w innych miejscach</dt><dd>{stats.adoptions}</dd>
          {stats.avgSignal != null && (<><dt className="font-bold">Średni sygnał radaru</dt><dd>{stats.avgSignal}/100: {signalLevel(stats.avgSignal).label}</dd></>)}
          {stats.sectors.length > 0 && (
            <><dt className="font-bold">Sektory</dt><dd>{stats.sectors.map((s) => `${sectorLabel(s.sector)} (${s.count})`).join(", ")}</dd></>
          )}
        </dl>
      </section>

      <section aria-labelledby="innowacje" className="space-y-4">
        <h2 id="innowacje" className="text-3xl font-bold">Innowacje instytucji</h2>
        {items.length === 0 ? (
          <p className="max-w-[68ch] text-lg">Ta instytucja nie ma jeszcze opublikowanych innowacji. Jeśli ją reprezentujesz, zgłoś pierwszą.</p>
        ) : (
          <>
            <p className="text-lg">{items.length} {plural(items.length, "innowacja", "innowacje", "innowacji")}.</p>
            <ul className="max-w-[56rem] divide-y divide-border border-y border-border">
              {items.map((i) => (
                <li key={i.id} className="space-y-1 py-5">
                  <h3 className="text-xl font-bold">
                    {i.slug ? <Link href={initiativeHref(i.slug)} className={linkClass}>{i.title}</Link> : i.title}
                  </h3>
                  <p>{i.summary}</p>
                  <p className="text-base text-muted-foreground">
                    {[i.innovation_kind && innovationKindLabel(i.innovation_kind), i.trl != null && `TRL ${i.trl}`].filter(Boolean).join(" · ")}
                  </p>
                  {i.signal != null && <p><Badge>Sygnał {i.signal}/100: {signalLevel(i.signal).label}</Badge></p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="zglos" className="full-bleed space-y-4 bg-secondary py-10">
        <h2 id="zglos" className="text-3xl font-bold">Macie coś, co działa u Was?</h2>
        <p className="max-w-[68ch] text-lg">Opisz to własnymi słowami. Karta, ocena i ścieżki rozwoju powstaną z Twojego opisu.</p>
        <Button asChild size="lg"><Link href="/zglos">Zgłoś innowację</Link></Button>
      </section>
    </article>
  );
}
