import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/knowledge/breadcrumbs";
import { FactList } from "@/components/knowledge/fact-list";
import { AreaIcon } from "@/components/knowledge/icons";
import { MaterialList } from "@/components/knowledge/material-list";
import { PersonaStory } from "@/components/knowledge/persona";
import { InnovationTiles } from "@/components/knowledge/tiles";
import { Button } from "@/components/ui/button";
import { knowledge } from "@/lib/knowledge";
import { plural } from "@/lib/pl";

const SHOWN = 6;

export async function generateMetadata(props: PageProps<"/biblioteka/obszar/[slug]">): Promise<Metadata> {
  const area = await knowledge.area((await props.params).slug);
  return area ? { title: `${area.name} · Biblioteka i wiedza`, description: area.lead } : {};
}

/** Wszystko o jednej kwestii na jednym ekranie. */
export default async function Page(props: PageProps<"/biblioteka/obszar/[slug]">) {
  const area = await knowledge.area((await props.params).slug);
  if (!area) notFound();

  const [facts, innovations, materials, personas, allInnovations] = await Promise.all([
    knowledge.facts(area.key),
    knowledge.innovations({ area: area.key }),
    knowledge.materials({ area: area.key }),
    knowledge.personas(),
    knowledge.innovations(),
  ]);
  const persona = personas.find((p) => p.area === area.key);
  const personaInnovations = persona
    ? persona.innovationSlugs.flatMap((s) => allInnovations.filter((i) => i.slug === s))
    : [];

  return (
    <article className="space-y-14">
      <div className="space-y-6">
        <Breadcrumbs items={[{ href: "/biblioteka", label: "Biblioteka i wiedza" }, { label: area.name }]} />
        <h1 className="flex items-center gap-4 text-4xl font-bold">
          <AreaIcon area={area.key} className="size-10 shrink-0" />
          {area.name}
        </h1>
        <p className="max-w-2xl text-xl">{area.lead}</p>
      </div>

      <section aria-labelledby="czym-jest" className="space-y-4">
        <h2 id="czym-jest" className="text-3xl font-bold">Czym jest ten obszar</h2>
        <p className="max-w-[44rem] text-lg">{area.definition}</p>
      </section>

      <section aria-labelledby="wyzwania" className="space-y-4">
        <h2 id="wyzwania" className="text-3xl font-bold">Najważniejsze wyzwania</h2>
        <ul className="max-w-[44rem] list-disc space-y-2 pl-6 text-lg">
          {area.challenges.map((c) => <li key={c}>{c}</li>)}
        </ul>
        {area.challengesSource && (
          <p className="max-w-[44rem] text-base text-muted-foreground">
            Na podstawie:{" "}
            <a href={area.challengesSource.url} className="font-bold text-foreground underline decoration-1 underline-offset-4 hover:decoration-2">
              {area.challengesSource.title}
            </a>{" "}
            (ROPS w Krakowie). {area.challengesSource.note}
          </p>
        )}
      </section>

      <section aria-labelledby="w-liczbach" className="space-y-4">
        <h2 id="w-liczbach" className="text-3xl font-bold">Małopolska w liczbach</h2>
        <FactList facts={facts} />
      </section>

      {persona && <PersonaStory persona={persona} innovations={personaInnovations} />}

      <section aria-labelledby="innowacje" className="space-y-6">
        <h2 id="innowacje" className="text-3xl font-bold">Innowacje, które na to odpowiadają</h2>
        {innovations.length ? (
          <>
            <InnovationTiles items={innovations.slice(0, SHOWN)} />
            {innovations.length > SHOWN && (
              <p>
                <Link href={`/biblioteka?tab=library&obszar=${area.key}#dzialy`} className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
                  Zobacz wszystkie: {innovations.length} {plural(innovations.length, "innowacja", "innowacje", "innowacji")} w obszarze „{area.name}”
                </Link>
              </p>
            )}
          </>
        ) : (
          <p>W bibliotece nie ma jeszcze innowacji z tego obszaru.</p>
        )}
      </section>

      <section aria-labelledby="materialy" className="space-y-6">
        <h2 id="materialy" className="text-3xl font-bold">Materiały do nauki</h2>
        <MaterialList items={materials} />
      </section>

      <section aria-labelledby="opisz" className="full-bleed space-y-4 bg-secondary py-10">
        <h2 id="opisz" className="text-3xl font-bold">Masz taki problem u siebie?</h2>
        <p className="max-w-[44rem] text-lg">Opisz go swoimi słowami. Pokażemy rozwiązania, które już działają, i podpowiemy, co dostosować.</p>
        <Button asChild size="lg">
          <Link href={`/opisz?obszar=${area.key}`}>Opisz problem</Link>
        </Button>
      </section>
    </article>
  );
}
