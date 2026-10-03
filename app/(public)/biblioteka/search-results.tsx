import Link from "next/link";
import { AreaIcon } from "@/components/knowledge/icons";
import { MaterialList } from "@/components/knowledge/material-list";
import { areaHref, InnovationTiles } from "@/components/knowledge/tiles";
import type { KnowledgeResults } from "@/lib/knowledge/search";
import { plural } from "@/lib/pl";

export function resultsSummary(r: KnowledgeResults): string {
  const total = r.areas.length + r.innovations.length + r.materials.length;
  if (!total) return `Nie znaleźliśmy nic dla: „${r.query}”.`;
  const parts = [
    r.areas.length && `${r.areas.length} ${plural(r.areas.length, "obszar", "obszary", "obszarów")}`,
    r.innovations.length && `${r.innovations.length} ${plural(r.innovations.length, "innowację", "innowacje", "innowacji")}`,
    r.materials.length && `${r.materials.length} ${plural(r.materials.length, "materiał", "materiały", "materiałów")}`,
  ].filter(Boolean);
  return `Dla „${r.query}” znaleźliśmy: ${parts.join(", ")}.`;
}

/** Wyniki pogrupowane: Obszary / Innowacje / Materiały. Liczbę wyników ogłasza region role="status" na stronie. */
export function SearchResults({ results: r }: { results: KnowledgeResults }) {
  const empty = !r.areas.length && !r.innovations.length && !r.materials.length;
  return (
    <section aria-labelledby="wyniki" className="space-y-10">
      <h2 id="wyniki" className="text-3xl font-bold">Wyniki wyszukiwania</h2>
      {empty && (
        <div className="space-y-3">
          <p className="text-lg">Spróbuj innych słów albo wybierz temat poniżej.</p>
          <p>
            <Link href={`/opisz?opis=${encodeURIComponent(r.query)}`} className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
              Opisz swój problem, a poszukamy rozwiązania razem z ekspertami
            </Link>
          </p>
        </div>
      )}
      {r.areas.length > 0 && (
        <section aria-labelledby="wyniki-obszary" className="space-y-4">
          <h3 id="wyniki-obszary" className="text-2xl font-bold">Obszary</h3>
          <ul className="max-w-[48rem] divide-y divide-border border-y border-border">
            {r.areas.map((a) => (
              <li key={a.key} className="flex items-start gap-4 py-5">
                <AreaIcon area={a.key} className="mt-1 size-8 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-xl font-bold">
                    <Link href={areaHref(a.slug)} className="underline decoration-1 underline-offset-4 hover:decoration-2">{a.name}</Link>
                  </h4>
                  <p>{a.lead}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {r.innovations.length > 0 && (
        <section aria-labelledby="wyniki-innowacje" className="space-y-4">
          <h3 id="wyniki-innowacje" className="text-2xl font-bold">Innowacje</h3>
          <InnovationTiles items={r.innovations} level={4} />
        </section>
      )}
      {r.materials.length > 0 && (
        <section aria-labelledby="wyniki-materialy" className="space-y-4">
          <h3 id="wyniki-materialy" className="text-2xl font-bold">Materiały</h3>
          <MaterialList items={r.materials} headingLevel={4} />
        </section>
      )}
    </section>
  );
}
