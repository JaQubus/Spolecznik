import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/knowledge/breadcrumbs";
import { StorySteps } from "@/components/knowledge/story-steps";
import { DomainBadge } from "@/components/taxonomy/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicInitiative, publicInitiativesAvailable } from "@/lib/initiatives/public";
import { crossLabel, institutionLabel, signalLevel, stageLabel } from "@/lib/taxonomy";
import { safeDecode } from "../../wiedza/shared";

async function load(props: PageProps<"/inicjatywy/[slug]">) {
  if (!publicInitiativesAvailable()) return null;
  return getPublicInitiative(safeDecode((await props.params).slug));
}

export async function generateMetadata(props: PageProps<"/inicjatywy/[slug]">): Promise<Metadata> {
  const i = await load(props);
  return i ? { title: `${i.title} · Inicjatywy`, description: i.summary } : {};
}

/** Opublikowana inicjatywa: historia w krokach problem → rozwiązanie → efekty → jak przenieść. */
export default async function Page(props: PageProps<"/inicjatywy/[slug]">) {
  const i = await load(props);
  if (!i) notFound();
  const param = `inicjatywa=${encodeURIComponent(i.slug ?? i.id)}`;

  return (
    <article className="space-y-14">
      <div className="space-y-6">
        <Breadcrumbs items={[{ href: "/inicjatywy", label: "Inicjatywy" }, { label: i.title }]} />
        <h1 className="text-4xl font-bold">{i.title}</h1>
        <p className="max-w-2xl text-xl">{i.summary}</p>
        <p className="flex flex-wrap gap-2">
          {i.signal != null && <Badge>Sygnał {i.signal}/100: {signalLevel(i.signal).label}</Badge>}
          {i.synthetic && <Badge>Przykład demonstracyjny</Badge>}
        </p>
        <dl className="grid max-w-[48rem] gap-x-6 gap-y-3 text-lg sm:grid-cols-[auto_1fr]">
          {i.municipality && (<><dt className="font-bold">Gdzie</dt><dd>gmina {i.municipality}{i.county && `, powiat ${i.county.replace(/^m\. /, "")}`}</dd></>)}
          {i.institution_type && (<><dt className="font-bold">Kto prowadzi</dt><dd>{institutionLabel(i.institution_type)}</dd></>)}
          {i.stage && (<><dt className="font-bold">Etap</dt><dd>{stageLabel(i.stage)}</dd></>)}
          {i.domains.length > 0 && (
            <>
              <dt className="font-bold">Dziedziny</dt>
              <dd><ul className="flex flex-wrap gap-2" aria-label="Dziedziny">{i.domains.map((d) => <li key={d}><DomainBadge domain={d} /></li>)}</ul></dd>
            </>
          )}
          {i.cross_topics.length > 0 && (<><dt className="font-bold">Tematy</dt><dd>{i.cross_topics.map(crossLabel).join(", ")}</dd></>)}
          {i.nominations_count > 0 && (<><dt className="font-bold">Wskazania</dt><dd>{i.nominations_count}</dd></>)}
        </dl>
      </div>

      <section aria-label="Historia inicjatywy w 4 krokach">
        <StorySteps story={{
          problem: i.card.problem ?? null, beneficiaries: i.card.beneficiaries ?? null, solution: i.card.solution ?? null,
          evidence: i.card.effects ?? null, howToUse: null,
          whoCanUse: i.institution_type ? `${institutionLabel(i.institution_type)} w innej gminie. Skorzystaj z „Przenieś do siebie”, żeby dostać plan dopasowany do Twojej gminy.` : null,
          adoptionsCount: i.adoptions_count, avgRating: i.avg_rating, sourceParam: param,
        }} />
      </section>

      <section aria-labelledby="dzialaj" className="full-bleed space-y-4 bg-secondary py-10">
        <h2 id="dzialaj" className="text-3xl font-bold">Chcesz to mieć u siebie?</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg"><Link href={`/przenies?${param}`}>Przenieś do siebie</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href={`/wyprobuj?${param}`}>Wypróbowaliśmy u nas</Link></Button>
        </div>
      </section>
    </article>
  );
}
