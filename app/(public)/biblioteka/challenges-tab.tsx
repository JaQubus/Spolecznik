import Link from "next/link";
import { isShowable } from "@/components/knowledge/fact-list";
import { AreaIcon } from "@/components/knowledge/icons";
import { areaHref } from "@/components/knowledge/tiles";
import { flags } from "@/lib/flags";
import { knowledge } from "@/lib/knowledge";

/** „Wyzwania Małopolski”: po jednej sprawdzonej liczbie na obszar + wejście do strony obszaru. */
export async function ChallengesTab() {
  const [areas, facts] = await Promise.all([knowledge.areas(), knowledge.facts()]);
  return (
    <section aria-labelledby="wyzwania-naglowek" className="space-y-8">
      <h2 id="wyzwania-naglowek" className="text-3xl font-bold">Wyzwania Małopolski</h2>
      <div className="max-w-[44rem] space-y-3 text-lg">
        <p>Najważniejsze problemy społeczne w regionie. Każda liczba ma źródło: raport ROPS albo Obserwator Statystyk Społecznych.</p>
        <p className="text-base text-muted-foreground">
          Opisy wyzwań pochodzą z Mapy Wyzwań Społecznych ROPS. Mapa opisuje sytuację w całej Polsce,
          a liczby o Małopolsce bierzemy z raportów regionalnych.
        </p>
      </div>
      {flags.mojaGmina && (
        <p><Link href="/moja-gmina" className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">Zobacz dane swojej gminy</Link></p>
      )}
      <ul className="divide-y divide-border border-y border-border">
        {areas.map((a) => {
          const fact = facts.find((f) => f.area === a.key && isShowable(f));
          return (
            <li key={a.key} className="grid gap-4 py-6 md:grid-cols-[16rem_1fr] md:gap-8">
              <h3 className="flex items-start gap-3 text-xl font-bold">
                <AreaIcon area={a.key} className="mt-1 size-7 shrink-0" />
                <Link href={areaHref(a.slug)} className="underline decoration-1 underline-offset-4 hover:decoration-2">{a.name}</Link>
              </h3>
              {fact ? (
                <div className="space-y-1">
                  <p><span className="text-2xl font-bold">{fact.displayValue}</span>{fact.isExample && " (przykład)"}</p>
                  <p>{fact.sentence}</p>
                  {fact.sourceTitle && (
                    <p className="text-base text-muted-foreground">Źródło: {fact.sourceTitle}{fact.sourceYear && `, ${fact.sourceYear}`}.</p>
                  )}
                </div>
              ) : (
                <p>{a.lead}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
