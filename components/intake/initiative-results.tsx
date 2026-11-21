"use client";

import { UsersIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { DomainBadge } from "@/components/taxonomy/icons";
import { ContactButton } from "@/components/pathways/contact-button";
import { PathwaysSection } from "@/components/pathways/pathways-section";
import { AuthorAssessmentSection } from "@/components/radar/author-assessment";
import { SimilarSources } from "@/components/sources/similar-sources";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initiativeHref } from "@/lib/knowledge/hrefs";
import { plural } from "@/lib/pl";
import type { InitiativeCard, InitiativeResponse, SubmissionKind } from "@/lib/schemas";
import { innovationKindLabel, institutionLabel, sectorLabel, stageLabel } from "@/lib/taxonomy";
import { org } from "@/lib/brand";
import { linkClass, StatusCode, SupportSections } from "./result-parts";

/**
 * Po zgłoszeniu albo wskazaniu: jak zrozumieliśmy inicjatywę, kod RAD, ocena radaru, ścieżki rozwoju i dopasowani partnerzy,
 * podobne inicjatywy z regionu i programy. Ocena radaru i uzasadnienie ścieżek
 * liczą się w tle — AuthorAssessmentSection dopytuje o nie i podmienia wstępne ścieżki (z reguł) na przeliczone z oceną.
 */
export function InitiativeResults({
  kind, card, result, onReset,
}: { kind: SubmissionKind; card: InitiativeCard; result: InitiativeResponse; onReset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Po pojawieniu się wyników przenosimy fokus na nagłówek — czytnik ekranu od razu go odczyta.
  useEffect(() => heading.current?.focus(), []);
  const { initiative, similar, similarGminy, programs } = result;
  const similarSources = result.similarSources ?? [];

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
          {kind === "nomination" ? "Dziękujemy za wskazanie" : "Dziękujemy za zgłoszenie"}
        </h2>
        <p className="max-w-[68ch] text-lg">
          Zespół {org.short} przeczyta je i sprawdzi ocenę radaru. Inicjatywa trafi do publicznej bazy dopiero po weryfikacji.
        </p>
        <div className="max-w-[68ch] space-y-1">
          <p className="text-lg"><strong>Zrozumieliśmy tak:</strong> {card.title}. {card.summary}</p>
          <p className="text-muted-foreground">
            {[card.innovationKind && `Innowacja ${innovationKindLabel(card.innovationKind).toLowerCase()}`,
              card.institutionType && institutionLabel(card.institutionType), stageLabel(card.stage), card.trl != null && `TRL ${card.trl}`,
              initiative.gmina].filter(Boolean).join(" · ")}
          </p>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Dziedziny i sektory">
          {card.domains.map((d) => <li key={d}><DomainBadge domain={d} /></li>)}
          {(card.sectors ?? []).filter((s) => s !== "inne").map((s) => <li key={s}><Badge variant="outline">{sectorLabel(s)}</Badge></li>)}
        </ul>
      </div>

      <StatusCode code={initiative.statusCode} accessKey={initiative.accessKey} />

      {/* Ocena radaru liczy się w tle; do czasu jej nadejścia ścieżki są wstępne, z samych reguł. */}
      <AuthorAssessmentSection
        code={initiative.statusCode}
        accessKey={initiative.accessKey}
        initialPathways={result.pathways ?? null}
        idPrefix="wynik-ocena"
        renderPathways={(view) => (
          <PathwaysSection
            view={view}
            audience="author"
            size="result"
            idPrefix="wynik-sciezki"
            contactNote={
              <p>
                {kind === "nomination"
                  ? `Kontakt z partnerem zestawiamy tylko za zgodą twórców. Zespół ${org.short} zapyta ich, gdy zweryfikuje wskazanie.`
                  : `„Poproś o kontakt” to Twoja zgoda. Zespół ${org.short} zapyta partnera, a gdy też się zgodzi, przedstawi was sobie w rozmowie.`}
              </p>
            }
            partnerAction={kind === "nomination" ? undefined : (m) => (
              <ContactButton code={initiative.statusCode} partnerId={m.partner.id} partnerName={m.partner.name} pathway={m.pathway} />
            )}
          />
        )}
      />

      <SimilarSources
        items={similarSources}
        intro="Radar znalazł w patentach, publikacjach i projektach coś bardzo podobnego. Sprawdź, czym się różnicie — to pomoże uniknąć dublowania prac, a autorzy mogą zostać partnerami."
      />

      {(similar.length > 0 || similarGminy.count > 0) && (
        <section aria-labelledby="podobne" className="max-w-3xl space-y-3">
          <h2 id="podobne" className="flex items-center gap-2 text-xl font-bold">
            <UsersIcon aria-hidden className="size-6 shrink-0" />
            Podobne inicjatywy w regionie
          </h2>
          {similarGminy.count > 0 && (
            <p className="text-lg">
              Coś podobnego działa jeszcze w {similarGminy.count} {plural(similarGminy.count, "innym miejscu", "innych miejscach", "innych miejscach")} regionu.
              Warto się porównać, zanim zaczniecie powtarzać tę samą pracę.
            </p>
          )}
          {similar.length > 0 && (
            <ul className="list-disc space-y-1 pl-6">
              {similar.map((s) => (
                <li key={s.id}>
                  {s.slug ? <Link href={initiativeHref(s.slug)} className={linkClass}>{s.title}</Link> : s.title}
                  {s.gmina && <span className="text-muted-foreground"> · {s.gmina}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <SupportSections programs={programs} />

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onReset}>{kind === "nomination" ? "Wskaż kolejną inicjatywę" : "Zgłoś kolejną inicjatywę"}</Button>
        <Button asChild variant="link"><Link href="/zglos/warsztat">Rozwiń pomysł w warsztacie</Link></Button>
      </div>
    </div>
  );
}
