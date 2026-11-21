import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, DocumentTextIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/knowledge/breadcrumbs";
import { EasyText } from "@/components/knowledge/easy-text";
import { StorySteps } from "@/components/knowledge/story-steps";
import { domainHref, PatternTiles } from "@/components/knowledge/tiles";
import { VideoEmbed } from "@/components/knowledge/video-embed";
import { DomainBadge, TYPE_ICONS } from "@/components/taxonomy/icons";
import { Button } from "@/components/ui/button";
import { knowledge } from "@/lib/knowledge";
import { formatBytes, isHugeFile, TYPE_LABELS } from "@/lib/knowledge/labels";
import { similarPatterns } from "@/lib/knowledge/similar";
import { institutionLabel } from "@/lib/taxonomy";
import { safeDecode } from "../../wiedza/shared";

export async function generateMetadata(props: PageProps<"/rozwiazania/[slug]">): Promise<Metadata> {
  const p = await knowledge.pattern(safeDecode((await props.params).slug));
  return p ? { title: `${p.title} · Sprawdzone rozwiązania`, description: p.etrSummary ?? p.problem ?? undefined } : {};
}

const link = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/** Sprawdzone rozwiązanie z Polski jako historia w 4 krokach, ze źródłem i licencją. */
export default async function Page(props: PageProps<"/rozwiazania/[slug]">) {
  const p = await knowledge.pattern(safeDecode((await props.params).slug));
  if (!p) notFound();
  const [domains, similar] = await Promise.all([knowledge.domains(), similarPatterns(p)]);
  const firstDomain = domains.find((d) => d.key === p.domains[0]);
  const TypeIcon = p.innovationType ? TYPE_ICONS[p.innovationType] : null;
  const zipSize = formatBytes(p.materialsZip?.sizeBytes);
  const param = `rozwiazanie=${encodeURIComponent(p.slug ?? p.id)}`;

  return (
    <article className="space-y-14">
      <div className="space-y-6">
        <Breadcrumbs items={[
          { href: "/wiedza?tab=rozwiazania", label: "Sprawdzone rozwiązania" },
          ...(firstDomain ? [{ href: domainHref(firstDomain.slug), label: firstDomain.name }] : []),
          { label: p.title },
        ]} />
        <h1 className="text-4xl font-bold">{p.title}</h1>
        <p className="text-base text-muted-foreground">
          Sprawdzone rozwiązanie z Polski{p.sourceName ? ` · źródło: ${p.sourceName}` : ""}.
          {p.synthetic && " Przykładowe dane do pokazu."}
        </p>

        <dl className="grid max-w-[48rem] gap-x-6 gap-y-3 text-lg sm:grid-cols-[auto_1fr]">
          {p.institutionTypes.length > 0 && (
            <>
              <dt className="font-bold">Kto może przenieść</dt>
              <dd>{p.institutionTypes.map(institutionLabel).join(", ")}</dd>
            </>
          )}
          {p.innovationType && TypeIcon && (
            <>
              <dt className="font-bold">Rodzaj</dt>
              <dd className="inline-flex items-center gap-2"><TypeIcon aria-hidden className="size-5" />{TYPE_LABELS[p.innovationType]}</dd>
            </>
          )}
          {p.domains.length > 0 && (
            <>
              <dt className="font-bold">Dziedziny</dt>
              <dd>
                <ul className="flex flex-wrap gap-2" aria-label="Dziedziny">
                  {p.domains.map((d) => <li key={d}><DomainBadge domain={d} /></li>)}
                </ul>
                {p.domainsAuto && <p className="mt-1 text-base text-muted-foreground">Dziedziny przypisane automatycznie.</p>}
              </dd>
            </>
          )}
        </dl>
        {p.dissemination && (
          <p className="text-lg"><strong>Wybrane przez autorów Biblioteki do upowszechniania</strong> — przetestowane i polecane do przenoszenia.</p>
        )}
        {p.etrSummary && <EasyText text={p.etrSummary} />}
      </div>

      {p.video && (
        <section aria-labelledby="film" className="space-y-4">
          <h2 id="film" className="text-3xl font-bold">Zobacz film</h2>
          <VideoEmbed
            video={p.video}
            description={
              <p>
                <strong>O czym jest film:</strong> film pokazuje rozwiązanie „{p.title}” i jego twórców.
                Najważniejsze informacje z filmu znajdziesz też w czterech krokach poniżej.
              </p>
            }
          />
        </section>
      )}

      <section aria-label="Historia rozwiązania w 4 krokach">
        <StorySteps story={{
          problem: p.problem, beneficiaries: p.beneficiaries, solution: p.solution, components: p.components,
          evidence: p.evidence, howToUse: p.howToUse, whoCanUse: p.whoCanUse,
          adoptionsCount: p.adoptionsCount, avgRating: p.avgRating, sourceParam: param,
        }} />
      </section>

      <section aria-labelledby="pobierz" className="space-y-4">
        <h2 id="pobierz" className="text-3xl font-bold">Materiały do pobrania i źródło</h2>
        <ul className="max-w-[48rem] space-y-3 text-lg">
          {p.materialsZip?.linkOk && (
            <li className="space-y-1">
              <a href={p.materialsZip.url} className={`inline-flex items-start gap-2 ${link}`}>
                <ArrowDownTrayIcon aria-hidden className="mt-1 size-5 shrink-0" />
                Pobierz wszystkie materiały: {p.title} (archiwum ZIP{zipSize && `, ${zipSize}`}, po polsku)
              </a>
              {isHugeFile(p.materialsZip.sizeBytes) && (
                <p className="flex items-start gap-2 text-base">
                  <ExclamationTriangleIcon aria-hidden className="mt-1 size-5 shrink-0" />
                  To bardzo duży plik. Pobieraj przez Wi-Fi, może to potrwać długo.
                </p>
              )}
            </li>
          )}
          {p.pdfUrl && (
            <li>
              <a href={p.pdfUrl} className={`inline-flex items-start gap-2 ${link}`}>
                <DocumentTextIcon aria-hidden className="mt-1 size-5 shrink-0" />
                Pobierz opis rozwiązania: {p.title} (PDF, po polsku)
              </a>
            </li>
          )}
          {p.sourceUrl && (
            <li>
              <a href={p.sourceUrl} className={`inline-flex items-start gap-2 ${link}`}>
                <ArrowTopRightOnSquareIcon aria-hidden className="mt-1 size-5 shrink-0" />
                Zobacz rozwiązanie u źródła{p.sourceName ? `: ${p.sourceName}` : ""}
              </a>
            </li>
          )}
        </ul>
        {p.licenseUrl && (
          <p className="max-w-[48rem] text-base">
            Materiały są na <a href={p.licenseUrl} className={link}>licencji Creative Commons Uznanie autorstwa 4.0</a>.
            Możesz z nich korzystać za darmo, także zmieniać je i rozpowszechniać, jeśli podasz autora.
          </p>
        )}
      </section>

      <section aria-labelledby="dzialaj" className="full-bleed space-y-4 bg-secondary py-10">
        <h2 id="dzialaj" className="text-3xl font-bold">Chcesz to mieć u siebie?</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg"><Link href={`/przenies?${param}`}>Przenieś do siebie</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href={`/wyprobuj?${param}`}>Wypróbowaliśmy u nas</Link></Button>
        </div>
      </section>

      {similar.length > 0 && (
        <section aria-labelledby="podobne" className="space-y-6">
          <h2 id="podobne" className="text-3xl font-bold">Podobne rozwiązania</h2>
          <PatternTiles items={similar} />
        </section>
      )}
    </article>
  );
}
