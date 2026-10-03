import { Badge } from "@/components/ui/badge";
import type { Fact } from "@/lib/knowledge/types";

/** Fakt bez źródła i bez etykiety „przykład” nie może się wyświetlić (wymóg modułu). */
export const isShowable = (f: Fact) => f.isExample || (!!f.sourceTitle && !!f.sourceUrl && !!f.sourceYear);

function SourceLine({ f }: { f: Fact }) {
  if (!f.sourceTitle || !f.sourceUrl) return null;
  const details = [f.sourcePublisher, f.sourceYear, f.sourcePage && `s. ${f.sourcePage}`].filter(Boolean).join(", ");
  return (
    <p className="text-base text-muted-foreground">
      Źródło:{" "}
      <a href={f.sourceUrl} className="font-bold text-foreground underline decoration-1 underline-offset-4 hover:decoration-2">
        {f.sourceTitle}
      </a>
      {details && `, ${details}`}.{f.dataYear && f.dataYear !== f.sourceYear && ` Dane z ${f.dataYear} roku.`}
    </p>
  );
}

/** „Małopolska w liczbach”: wiersze rozdzielone linią, bez kart (design system: bez kafli ze statystykami). */
export function FactList({ facts }: { facts: Fact[] }) {
  const shown = facts.filter(isShowable);
  if (!shown.length) return <p>Nie mamy jeszcze sprawdzonych liczb dla tego obszaru.</p>;
  return (
    <ul className="divide-y divide-border border-y border-border">
      {shown.map((f) => (
        <li key={f.id} className="grid gap-2 py-6 sm:grid-cols-[minmax(9rem,13rem)_1fr] sm:gap-6">
          <p className="text-3xl leading-tight font-bold">{f.displayValue}</p>
          <div className="space-y-2">
            <p className="text-lg">{f.sentence}</p>
            {f.isExample && (
              <p className="flex flex-wrap items-center gap-2 text-base">
                <Badge>przykład</Badge>
                <span>Liczba przykładowa. Nie pochodzi z potwierdzonego źródła.</span>
              </p>
            )}
            <SourceLine f={f} />
          </div>
        </li>
      ))}
    </ul>
  );
}
