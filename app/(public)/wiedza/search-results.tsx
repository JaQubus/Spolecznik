import Link from "next/link";
import { MaterialList } from "@/components/knowledge/material-list";
import { DomainList, PatternList } from "@/components/knowledge/tiles";
import type { KnowledgeResults } from "@/lib/knowledge/search";
import { plural } from "@/lib/pl";

export function resultsSummary(r: KnowledgeResults): string {
  const total = r.domains.length + r.patterns.length + r.materials.length;
  if (!total) return `Nie znaleźliśmy nic dla: „${r.query}”.`;
  const parts = [
    r.domains.length && `${r.domains.length} ${plural(r.domains.length, "dziedzinę", "dziedziny", "dziedzin")}`,
    r.patterns.length && `${r.patterns.length} ${plural(r.patterns.length, "rozwiązanie", "rozwiązania", "rozwiązań")}`,
    r.materials.length && `${r.materials.length} ${plural(r.materials.length, "materiał", "materiały", "materiałów")}`,
  ].filter(Boolean);
  return `Dla „${r.query}” znaleźliśmy: ${parts.join(", ")}.`;
}

/** Wyniki pogrupowane: Dziedziny / Rozwiązania / Materiały. Liczbę wyników ogłasza region role="status" na stronie. */
export function SearchResults({ results: r }: { results: KnowledgeResults }) {
  const empty = !r.domains.length && !r.patterns.length && !r.materials.length;
  return (
    <section aria-labelledby="wyniki" className="space-y-10">
      <h2 id="wyniki" className="text-3xl font-bold">Wyniki wyszukiwania</h2>
      {empty && (
        <div className="space-y-3">
          <p className="text-lg">Spróbuj innych słów albo wybierz dziedzinę poniżej.</p>
          <p>
            <Link href={`/szukam?opis=${encodeURIComponent(r.query)}`} className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
              Opisz swój problem, a poszukamy inicjatyw i rozwiązań, które na niego odpowiadają
            </Link>
          </p>
        </div>
      )}
      {r.domains.length > 0 && (
        <section aria-labelledby="wyniki-dziedziny" className="space-y-4">
          <h3 id="wyniki-dziedziny" className="text-2xl font-bold">Dziedziny</h3>
          <DomainList domains={r.domains} level={4} />
        </section>
      )}
      {r.patterns.length > 0 && (
        <section aria-labelledby="wyniki-rozwiazania" className="space-y-4">
          <h3 id="wyniki-rozwiazania" className="text-2xl font-bold">Sprawdzone rozwiązania</h3>
          <PatternList items={r.patterns} level={4} />
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
