import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, DocumentTextIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/knowledge/breadcrumbs";
import { EasyText } from "@/components/knowledge/easy-text";
import { GROUP_ICONS, TYPE_ICONS } from "@/components/knowledge/icons";
import { StorySteps } from "@/components/knowledge/story-steps";
import { areaHref, InnovationTiles } from "@/components/knowledge/tiles";
import { VideoEmbed } from "@/components/knowledge/video-embed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { flags } from "@/lib/flags";
import { knowledge } from "@/lib/knowledge";
import { formatBytes, isHugeFile, TYPE_LABELS } from "@/lib/knowledge/labels";
import { similarInnovations } from "@/lib/knowledge/similar";
import { AREA_LABELS, GROUP_LABELS } from "@/lib/taxonomy";

export async function generateMetadata(props: PageProps<"/biblioteka/innowacja/[slug]">): Promise<Metadata> {
  const i = await knowledge.innovation((await props.params).slug);
  return i ? { title: `${i.title} · Biblioteka i wiedza`, description: i.etrSummary ?? i.problem ?? undefined } : {};
}

const link = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/** Karta innowacji jako historia w 4 krokach. */
export default async function Page(props: PageProps<"/biblioteka/innowacja/[slug]">) {
  const i = await knowledge.innovation((await props.params).slug);
  if (!i) notFound();
  const [areas, similar] = await Promise.all([knowledge.areas(), similarInnovations(i)]);
  const firstArea = areas.find((a) => a.key === i.areas[0]);
  const TypeIcon = i.innovationType ? TYPE_ICONS[i.innovationType] : null;
  const zipSize = formatBytes(i.materialsZip?.sizeBytes);

  return (
    <article className="space-y-14">
      <div className="space-y-6">
        <Breadcrumbs items={[
          { href: "/biblioteka", label: "Biblioteka i wiedza" },
          ...(firstArea ? [{ href: areaHref(firstArea.slug), label: firstArea.name }] : []),
          { label: i.title },
        ]} />
        <h1 className="text-4xl font-bold">{i.title}</h1>

        <dl className="grid max-w-[48rem] gap-x-6 gap-y-3 text-lg sm:grid-cols-[auto_1fr]">
          <dt className="font-bold">Dla kogo</dt>
          <dd className="flex flex-wrap gap-x-4 gap-y-1">
            {i.groups.map((g) => {
              const Icon = GROUP_ICONS[g];
              return <span key={g} className="inline-flex items-center gap-2"><Icon aria-hidden className="size-5" />{GROUP_LABELS[g].replace(/^Dla /, "")}</span>;
            })}
          </dd>
          {i.innovationType && TypeIcon && (
            <>
              <dt className="font-bold">Rodzaj</dt>
              <dd className="inline-flex items-center gap-2">
                <TypeIcon aria-hidden className="size-5" />{TYPE_LABELS[i.innovationType]}
                {i.typeAuto && <span className="text-base text-muted-foreground">(przypisany automatycznie)</span>}
              </dd>
            </>
          )}
          {i.areas.length > 0 && (
            <>
              <dt className="font-bold">Obszary</dt>
              <dd>
                <ul className="flex flex-wrap gap-2" aria-label="Obszary Mapy Wyzwań">
                  {i.areas.map((a) => <li key={a}><Badge>{AREA_LABELS[a]}</Badge></li>)}
                </ul>
              </dd>
            </>
          )}
        </dl>
        {i.dissemination && (
          <p className="text-lg"><strong>Wybrana przez ROPS do upowszechniania</strong> — przetestowana i polecana do wdrażania w innych miejscach.</p>
        )}
        {i.etrSummary && <EasyText text={i.etrSummary} />}
      </div>

      {i.video && (
        <section aria-labelledby="film" className="space-y-4">
          <h2 id="film" className="text-3xl font-bold">Zobacz film</h2>
          <VideoEmbed
            video={i.video}
            description={
              <p>
                <strong>O czym jest film:</strong> film pokazuje innowację „{i.title}” i jej twórców.
                Najważniejsze informacje z filmu znajdziesz też w czterech krokach poniżej.
              </p>
            }
          />
        </section>
      )}

      <section aria-label="Historia innowacji w 4 krokach">
        <StorySteps innovation={i} />
      </section>

      <section aria-labelledby="pobierz" className="space-y-4">
        <h2 id="pobierz" className="text-3xl font-bold">Materiały do pobrania</h2>
        <ul className="max-w-[48rem] space-y-3 text-lg">
          {i.materialsZip?.linkOk && (
            <li className="space-y-1">
              <a href={i.materialsZip.url} className={`inline-flex items-start gap-2 ${link}`}>
                <ArrowDownTrayIcon aria-hidden className="mt-1 size-5 shrink-0" />
                Pobierz wszystkie materiały: {i.title} (archiwum ZIP{zipSize && `, ${zipSize}`}, po polsku)
              </a>
              {isHugeFile(i.materialsZip.sizeBytes) && (
                <p className="flex items-start gap-2 text-base">
                  <ExclamationTriangleIcon aria-hidden className="mt-1 size-5 shrink-0" />
                  To bardzo duży plik. Pobieraj przez Wi-Fi, może to potrwać długo.
                </p>
              )}
            </li>
          )}
          {i.pdfUrl && (
            <li>
              <a href={i.pdfUrl} className={`inline-flex items-start gap-2 ${link}`}>
                <DocumentTextIcon aria-hidden className="mt-1 size-5 shrink-0" />
                Pobierz opis innowacji: {i.title} (PDF, po polsku)
              </a>
            </li>
          )}
          {i.sourceUrl && (
            <li>
              <a href={i.sourceUrl} className={`inline-flex items-start gap-2 ${link}`}>
                <ArrowTopRightOnSquareIcon aria-hidden className="mt-1 size-5 shrink-0" />
                Zobacz innowację na stronie ROPS w Krakowie
              </a>
            </li>
          )}
        </ul>
        {i.licenseUrl && (
          <p className="max-w-[48rem] text-base">
            Materiały są na{" "}
            <a href={i.licenseUrl} className={link}>licencji Creative Commons Uznanie autorstwa 4.0</a>.
            Możesz z nich korzystać za darmo, także zmieniać je i rozpowszechniać, jeśli podasz autora.
          </p>
        )}
      </section>

      {(flags.middleman || flags.tester) && (
        <section aria-labelledby="dzialaj" className="full-bleed space-y-4 bg-secondary py-10">
          <h2 id="dzialaj" className="text-3xl font-bold">Chcesz to mieć u siebie?</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            {flags.middleman && (
              <Button asChild size="lg"><Link href={`/wdrozenie?innowacja=${i.slug}`}>Jak to wdrożyć u nas?</Link></Button>
            )}
            {flags.tester && (
              <Button asChild size="lg" variant="outline"><Link href={`/przetestuj?innowacja=${i.slug}`}>Chcę przetestować</Link></Button>
            )}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section aria-labelledby="podobne" className="space-y-6">
          <h2 id="podobne" className="text-3xl font-bold">Podobne innowacje</h2>
          <InnovationTiles items={similar} />
        </section>
      )}
    </article>
  );
}
