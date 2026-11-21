"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { DomainBadge } from "@/components/taxonomy/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/pl";
import type { ChallengeCard, ChallengeResponse } from "@/lib/schemas";
import { org, region } from "@/lib/brand";
import { MatchRow, SupportSections } from "./result-parts";

/** „Szukam rozwiązania”: inicjatywy z regionu, które odpowiadają na opisany problem; luka trafia do Panelu. */
export function ChallengeResults({ card, result, onReset }: { card: ChallengeCard; result: ChallengeResponse; onReset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const { matches, isGap, programs } = result;
  const n = matches.length;

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
          {isGap ? "Nie znaleźliśmy jeszcze gotowego rozwiązania" : `Znaleźliśmy ${n} ${plural(n, "rozwiązanie", "rozwiązania", "rozwiązań")}`}
        </h2>
        <p className="max-w-[68ch] text-lg"><strong>Zrozumieliśmy tak:</strong> {card.summary}</p>
        <ul className="flex flex-wrap gap-2" aria-label="Dziedziny">
          {card.domains.map((d) => <li key={d}><DomainBadge domain={d} /></li>)}
        </ul>
      </div>

      {isGap && (
        // Luka: komunikat + jedyny zielony przycisk na ekranie (ResultList.md).
        <div className="space-y-4">
          <Alert title="To ważna informacja">
            <p>
              W bazie nie ma jeszcze innowacji, która dobrze pasuje. Zapisaliśmy to jako potrzebę{" "}
              {region.genitive} — dzięki temu {org.short} wie, czego szukać.
            </p>
            <p>Znasz kogoś, kto już to rozwiązał? Wskaż tę inicjatywę.</p>
          </Alert>
          <Button asChild className="w-full sm:w-auto"><Link href="/wskaz">Wskaż inicjatywę</Link></Button>
        </div>
      )}

      {matches.length > 0 && (
        <section aria-labelledby="z-regionu" className="max-w-3xl space-y-3">
          <h2 id="z-regionu" className="text-xl font-bold">Inicjatywy {region.locative}</h2>
          <ol>{matches.map((m) => <MatchRow key={m.id} match={m} />)}</ol>
        </section>
      )}

      <SupportSections programs={programs} />

      <Button variant="outline" onClick={onReset}>Opisz inny problem</Button>
    </div>
  );
}
