import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/knowledge/breadcrumbs";
import { FactList } from "@/components/knowledge/fact-list";
import { MaterialList } from "@/components/knowledge/material-list";
import { PatternTiles } from "@/components/knowledge/tiles";
import { DomainIcon } from "@/components/taxonomy/icons";
import { Button } from "@/components/ui/button";
import { knowledge } from "@/lib/knowledge";
import { plural } from "@/lib/pl";
import { region } from "@/lib/brand";

const SHOWN = 6;

export async function generateMetadata(props: PageProps<"/wiedza/dziedzina/[slug]">): Promise<Metadata> {
  const domain = await knowledge.domain((await props.params).slug);
  return domain ? { title: `${domain.name} · Wiedza`, description: domain.lead } : {};
}

/** Wszystko o jednej dziedzinie na jednym ekranie: wyzwania regionu, liczby ze źródłami, rozwiązania, materiały. */
export default async function Page(props: PageProps<"/wiedza/dziedzina/[slug]">) {
  const domain = await knowledge.domain((await props.params).slug);
  if (!domain) notFound();

  const [facts, patterns, materials] = await Promise.all([
    knowledge.facts(domain.key),
    knowledge.patterns({ domain: domain.key }),
    knowledge.materials({ domain: domain.key }),
  ]);

  return (
    <article className="space-y-14">
      <div className="space-y-6">
        <Breadcrumbs items={[{ href: "/wiedza", label: "Wiedza" }, { label: domain.name }]} />
        <h1 className="flex items-center gap-4 text-4xl font-bold">
          <DomainIcon domain={domain.key} className="size-16" iconClassName="size-9" />
          {domain.name}
        </h1>
        <p className="max-w-2xl text-xl">{domain.lead}</p>
      </div>

      <section aria-labelledby="czym-jest" className="space-y-4">
        <h2 id="czym-jest" className="text-3xl font-bold">Czego dotyczy ta dziedzina</h2>
        <p className="max-w-[44rem] text-lg">{domain.definition}</p>
      </section>

      {domain.challenges.length > 0 && (
        <section aria-labelledby="wyzwania" className="space-y-4">
          <h2 id="wyzwania" className="text-3xl font-bold">Wyzwania {region.genitive}</h2>
          <ul className="max-w-[44rem] list-disc space-y-2 pl-6 text-lg">
            {domain.challenges.map((c) => <li key={c}>{c}</li>)}
          </ul>
          {domain.challengesSource && (
            <p className="max-w-[44rem] text-base text-muted-foreground">
              Na podstawie:{" "}
              <a href={domain.challengesSource.url} className="font-bold text-link underline decoration-1 underline-offset-4 hover:decoration-2">
                {domain.challengesSource.title}
              </a>. {domain.challengesSource.note}
            </p>
          )}
        </section>
      )}

      {facts.length > 0 && (
        <section aria-labelledby="w-liczbach" className="space-y-4">
          <h2 id="w-liczbach" className="text-3xl font-bold">{region.name} w liczbach</h2>
          <FactList facts={facts} />
        </section>
      )}

      <section aria-labelledby="rozwiazania" className="space-y-6">
        <h2 id="rozwiazania" className="text-3xl font-bold">Sprawdzone rozwiązania z Polski</h2>
        {patterns.length ? (
          <>
            <PatternTiles items={patterns.slice(0, SHOWN)} />
            {patterns.length > SHOWN && (
              <p>
                <Link href={`/wiedza?tab=rozwiazania&dziedzina=${domain.key}#dzialy`} className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
                  Zobacz wszystkie: {patterns.length} {plural(patterns.length, "rozwiązanie", "rozwiązania", "rozwiązań")} w dziedzinie „{domain.name}”
                </Link>
              </p>
            )}
          </>
        ) : (
          <p>W bazie nie ma jeszcze rozwiązań z tej dziedziny.</p>
        )}
      </section>

      {materials.length > 0 && (
        <section aria-labelledby="materialy" className="space-y-6">
          <h2 id="materialy" className="text-3xl font-bold">Materiały do nauki</h2>
          <MaterialList items={materials} />
        </section>
      )}

      <section aria-labelledby="zglos" className="full-bleed space-y-4 bg-secondary py-10">
        <h2 id="zglos" className="text-3xl font-bold">Robicie u siebie coś w tej dziedzinie?</h2>
        <p className="max-w-[44rem] text-lg">Opisz to swoimi słowami. Pokażemy podobne inicjatywy w regionie i podpowiemy, jak ją rozwinąć.</p>
        <Button asChild size="lg">
          <Link href="/zglos">Zgłoś inicjatywę</Link>
        </Button>
      </section>
    </article>
  );
}
