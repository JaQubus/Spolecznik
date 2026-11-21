"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RadarNotes, RadarTable } from "@/components/radar/radar-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { org } from "@/lib/brand";
import type { AuthorAssessment } from "@/lib/initiatives/assessment";
import type { PathwaysView } from "@/lib/pathways/view";
import { signalLevel } from "@/lib/taxonomy";

const POLL_MS = 4000;
/** Klient przestaje pytać po tym czasie, nawet gdy serwer jeszcze nie uznał oceny za nieudaną. */
const GIVE_UP_MS = 4 * 60_000;
/** Na uzasadnienie ścieżek (drugie wywołanie modelu) czekamy krócej: ścieżki z reguł i tak już są. */
const NARRATIVE_WAIT_MS = 90_000;

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

/**
 * Ocena radaru dla autora: po zgłoszeniu model liczy ją w tle, więc dopytujemy /api/initiatives/assessment, aż będzie.
 * Wynik ogłasza region aria-live; fokus zostaje tam, gdzie był. `renderPathways` (tylko z komponentu klienckiego)
 * pokazuje ścieżki: najpierw wstępne z reguł, po ocenie — przeliczone z radarem i z uzasadnieniem od modelu.
 */
export function AuthorAssessmentSection({
  code, accessKey, initial = null, initialPathways = null, renderPathways, idPrefix = "ocena-autora",
}: {
  code: string;
  accessKey: string;
  initial?: AuthorAssessment | null;
  initialPathways?: PathwaysView | null;
  renderPathways?: (view: PathwaysView) => ReactNode;
  idPrefix?: string;
}) {
  const withPathways = !!renderPathways;
  const [state, setState] = useState<AuthorAssessment>(initial ?? { state: "pending" });
  const [narrativeTimedOut, setNarrativeTimedOut] = useState(false);
  const [announce, setAnnounce] = useState("");
  // Czasy liczymy od pierwszego zapytania (w efekcie, nie w renderze — render ma być czysty).
  const started = useRef<number | null>(null);
  const readyAt = useRef<number | null>(null);

  const waitingForRadar = state.state === "pending";
  const waitingForNarrative = withPathways && state.state === "ready" && !state.narrativeReady && !narrativeTimedOut;

  useEffect(() => {
    if (!waitingForRadar && !waitingForNarrative) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const now = Date.now();
      started.current ??= now;
      if (waitingForNarrative) readyAt.current ??= now;
      if (waitingForRadar && now - started.current > GIVE_UP_MS) return setState({ state: "failed" });
      if (waitingForNarrative && readyAt.current && now - readyAt.current > NARRATIVE_WAIT_MS) return setNarrativeTimedOut(true);
      try {
        const res = await fetch("/api/initiatives/assessment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, key: accessKey, pathways: withPathways }),
        });
        if (cancelled) return;
        // 429 i chwilowe błędy: zostajemy przy obecnym stanie, następna próba za POLL_MS (zmiana obiektu wznawia efekt).
        if (!res.ok) return setState((s) => ({ ...s }));
        const next = (await res.json()) as AuthorAssessment;
        if (cancelled) return;
        if (next.state === "ready" && state.state !== "ready") {
          readyAt.current = Date.now();
          setAnnounce(`Ocena radaru gotowa: sygnał ${next.signal} na 100, ${signalLevel(next.signal).label.toLowerCase()}.`);
        } else if (next.state === "ready" && next.narrativeReady && state.state === "ready" && !state.narrativeReady) {
          setAnnounce("Doszło uzasadnienie ścieżek rozwoju i kolejne kroki.");
        } else if (next.state === "failed") {
          setAnnounce("Ocena radaru nie jest jeszcze gotowa.");
        }
        setState(next);
      } catch {
        if (!cancelled) setState((s) => ({ ...s }));
      }
    }, POLL_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state, waitingForRadar, waitingForNarrative, code, accessKey, withPathways]);

  const pathways = (state.state === "ready" && state.pathways) || initialPathways;

  return (
    <div className="space-y-12">
      <section aria-labelledby={`${idPrefix}-naglowek`} aria-busy={waitingForRadar || undefined} className="space-y-4">
        <h2 id={`${idPrefix}-naglowek`} className="text-2xl font-bold">Ocena radaru</h2>
        <p role="status" aria-live="polite" className="sr-only">{announce}</p>

        {state.state === "pending" && (
          <>
            <p className="max-w-[68ch] text-lg">
              Radar ocenia inicjatywę w pięciu wymiarach: nowość, wpływ, dojrzałość, skalowalność i potencjał komercjalizacji
              lub finansowania. Zwykle trwa to do minuty. Wynik pojawi się tutaj, nie musisz odświeżać strony.
            </p>
            <div aria-hidden className="max-w-[56rem] space-y-3">
              {[0, 1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-10 w-full" />)}
            </div>
          </>
        )}

        {state.state === "failed" && (
          <Alert title="Ocena nie jest jeszcze gotowa">
            <p>
              Model nie zdążył ocenić zgłoszenia. Zespół {org.short} uruchomi ocenę ponownie, a wynik zobaczysz na{" "}
              <Link href={`/status/${code}`} className={linkClass}>stronie statusu</Link>.
            </p>
          </Alert>
        )}

        {state.state === "ready" && (
          <>
            <p className="flex flex-wrap gap-2">
              <Badge>Sygnał {state.signal}/100: {signalLevel(state.signal).label}</Badge>
            </p>
            <p className="max-w-[68ch] text-lg">
              Wstępna ocena według jawnych kryteriów. Przygotowało ją AI na podstawie opisu, a każdą ocenę popiera cytat
              z opisu albo informacja, że opis o tym nie mówi. Zespół {org.short} ją sprawdzi i może skorygować.
              {state.corrected && " Zespół już skorygował sygnał po weryfikacji."}{" "}
              <Link href="/metodologia" className={linkClass}>Jak liczymy sygnał radaru</Link>
            </p>
            <RadarTable radar={state.radar} id={`${idPrefix}-tabela`} />
            <RadarNotes radar={state.radar} />
          </>
        )}
      </section>

      {renderPathways && pathways && (
        <div className="space-y-4">
          {waitingForNarrative && (
            <p className="max-w-[68ch] text-muted-foreground">
              Ścieżki są już przeliczone z oceną radaru. Przygotowujemy jeszcze uzasadnienie i kolejne kroki.
            </p>
          )}
          {renderPathways(pathways)}
        </div>
      )}
    </div>
  );
}
