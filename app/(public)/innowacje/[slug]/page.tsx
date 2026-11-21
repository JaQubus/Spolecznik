import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/knowledge/breadcrumbs";
import { StorySteps } from "@/components/knowledge/story-steps";
import { DomainBadge } from "@/components/taxonomy/icons";
import { PathwaysSection } from "@/components/pathways/pathways-section";
import { RadarNotes, RadarTable } from "@/components/radar/radar-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicCreators, getPublicInitiative, getPublicPathways, publicInitiativesAvailable, type PublicCreator } from "@/lib/initiatives/public";
import { pathwaysFor, type PathwaysView } from "@/lib/pathways";
import { org } from "@/lib/brand";
import {
  creatorRoleLabel, crossLabel, innovationKindLabel, institutionLabel, ipStatusLabel, sectorLabel, signalLevel, stageLabel, trlLabel,
} from "@/lib/taxonomy";
import { readAssessment } from "@/lib/radar/score";
import { safeDecode } from "../../wiedza/shared";

async function load(props: PageProps<"/innowacje/[slug]">) {
  if (!publicInitiativesAvailable()) return null;
  return getPublicInitiative(safeDecode((await props.params).slug));
}

export async function generateMetadata(props: PageProps<"/innowacje/[slug]">): Promise<Metadata> {
  const i = await load(props);
  return i ? { title: `${i.title} · Innowacje`, description: i.summary } : {};
}

/** Opublikowana inicjatywa: historia w krokach problem → rozwiązanie → efekty → jak przenieść. */
export default async function Page(props: PageProps<"/innowacje/[slug]">) {
  const i = await load(props);
  if (!i) notFound();
  const param = `inicjatywa=${encodeURIComponent(i.slug ?? i.id)}`;
  const radar = readAssessment(i.radar);
  const [creators, narrative] = await Promise.all([
    getPublicCreators(i.id).catch((e) => { console.error("[inicjatywa] twórcy:", e); return [] as PublicCreator[]; }),
    getPublicPathways(i.id).catch((e) => { console.error("[inicjatywa] uzasadnienie ścieżek:", e); return null; }),
  ]);
  // Ścieżki i partnerzy z reguł (6/10); błąd nie zasłania reszty karty.
  const pathways = await pathwaysFor({ ...i, card: i.card, radar: i.radar, pathways: narrative })
    .catch((e): PathwaysView | null => { console.error("[inicjatywa] ścieżki:", e); return null; });

  return (
    <article className="space-y-14">
      <div className="space-y-6">
        <Breadcrumbs items={[{ href: "/innowacje", label: "Innowacje" }, { label: i.title }]} />
        <h1 className="text-4xl font-bold">{i.title}</h1>
        <p className="max-w-2xl text-xl">{i.summary}</p>
        <p className="flex flex-wrap gap-2">
          {i.signal != null && <Badge>Sygnał {i.signal}/100: {signalLevel(i.signal).label}</Badge>}
          {i.synthetic && <Badge>Przykład demonstracyjny</Badge>}
        </p>
        {i.signal != null && (
          <p><Link href="/metodologia" className="underline decoration-1 underline-offset-4 hover:decoration-2">Jak liczymy sygnał radaru</Link></p>
        )}
        <dl className="grid max-w-[48rem] gap-x-6 gap-y-3 text-lg sm:grid-cols-[auto_1fr]">
          {i.municipality && (<><dt className="font-bold">Gdzie</dt><dd>gmina {i.municipality}{i.county && `, powiat ${i.county.replace(/^m\. /, "")}`}</dd></>)}
          {(i.institution_name || i.institution_type) && (
            <>
              <dt className="font-bold">Kto prowadzi</dt>
              <dd>
                {i.institution_slug && i.institution_name
                  ? <Link href={`/instytucje/${encodeURIComponent(i.institution_slug)}`} className="underline decoration-1 underline-offset-4 hover:decoration-2">{i.institution_name}</Link>
                  : i.institution_name ?? institutionLabel(i.institution_type!)}
              </dd>
            </>
          )}
          {creators.length > 0 && (
            <><dt className="font-bold">Twórcy</dt><dd>{creatorNames(creators)}</dd></>
          )}
          {i.innovation_kind && (<><dt className="font-bold">Typ innowacji</dt><dd>{innovationKindLabel(i.innovation_kind)}</dd></>)}
          {i.sectors.length > 0 && (<><dt className="font-bold">Sektory PCI</dt><dd>{i.sectors.map(sectorLabel).join(", ")}</dd></>)}
          {i.stage && (<><dt className="font-bold">Etap</dt><dd>{stageLabel(i.stage)}</dd></>)}
          {i.trl != null && (<><dt className="font-bold">Gotowość technologii</dt><dd>{trlLabel(i.trl)}</dd></>)}
          {i.ip_status && (<><dt className="font-bold">Ochrona</dt><dd>{ipStatusLabel(i.ip_status)}</dd></>)}
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

      {radar && (
        <section aria-labelledby="ocena" className="space-y-4">
          <h2 id="ocena" className="text-3xl font-bold">Ocena radaru</h2>
          <p className="max-w-[68ch] text-lg">
            Wstępna ocena według jawnych kryteriów. Przygotowało ją AI na podstawie opisu, a zespół ją zweryfikował.
            {i.signal != null && i.signal !== radar.signal && " Zespół skorygował sygnał po weryfikacji."}
          </p>
          <RadarTable radar={radar} id="radar" />
          <RadarNotes radar={radar} />
        </section>
      )}

      {pathways && (
        <PathwaysSection
          view={pathways}
          audience="public"
          contactNote={
            <p className="text-muted-foreground">
              Kontakt z partnerem zestawia zespół {org.short}, gdy zgodzą się obie strony. Twórca może poprosić o kontakt w swojej rozmowie.
            </p>
          }
        />
      )}

      <section aria-labelledby="dzialaj" className="full-bleed space-y-4 bg-secondary py-10">
        <h2 id="dzialaj" className="text-3xl font-bold">Chcesz to mieć u siebie?</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg"><Link href={`/przenies?${param}`}>Przenieś do siebie</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href={`/wyprobuj?${param}`}>Wypróbowaliśmy u nas</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/szukam-innowacji">Chcę ją wdrożyć lub sfinansować</Link></Button>
        </div>
      </section>
    </article>
  );
}

/** Podpisy za zgodą, a role bez podpisu zbite z liczbą: „Uczeń ×3” zamiast „Uczeń, Uczeń, Uczeń”. */
function creatorNames(creators: PublicCreator[]): string {
  const named = creators.filter((c) => c.display_name).map((c) => c.display_name as string);
  const roles = new Map<string, number>();
  for (const c of creators) if (!c.display_name) roles.set(c.role, (roles.get(c.role) ?? 0) + 1);
  return [...named, ...[...roles].map(([role, n]) => (n > 1 ? `${creatorRoleLabel(role)} ×${n}` : creatorRoleLabel(role)))].join(", ");
}
