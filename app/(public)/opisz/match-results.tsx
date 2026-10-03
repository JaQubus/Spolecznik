"use client";

import { ThumbsDownIcon, ThumbsUpIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatDate, formatNumber, plural } from "@/lib/pl";
import type { InnovationMatch, MatchResponse, NeedCard } from "@/lib/schemas";
import { AREA_LABELS } from "@/lib/taxonomy";

function fitLabel(fit: number): string {
  if (fit >= 80) return "Bardzo dobrze pasuje";
  if (fit >= 65) return "Dobrze pasuje";
  return "Może pasować";
}

export function MatchResults({ card, result, onReset }: { card: NeedCard; result: MatchResponse; onReset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Po pojawieniu się wyników przenosimy fokus na nagłówek — czytnik ekranu od razu je odczyta.
  useEffect(() => heading.current?.focus(), []);

  const { need, matches, isGap, similarNeeds, experts, calls } = result;
  const n = matches.length;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
          {isGap ? "Nie znaleźliśmy jeszcze gotowego rozwiązania" : `Znaleźliśmy ${n} ${plural(n, "rozwiązanie", "rozwiązania", "rozwiązań")}`}
        </h2>
        <p className="text-lg"><strong>Zrozumieliśmy tak:</strong> {card.summary}</p>
        <ul className="flex flex-wrap gap-2" aria-label="Obszary">
          {card.areas.map((a) => <li key={a}><Badge variant="secondary">{AREA_LABELS[a]}</Badge></li>)}
        </ul>
      </div>

      <StatusCodeBox code={need.statusCode} />

      {isGap ? (
        <Card className="border-2 border-primary">
          <CardHeader><h3 className="text-xl font-semibold">To ważna informacja</h3></CardHeader>
          <CardContent className="space-y-3 text-lg">
            <p>
              W bibliotece nie ma jeszcze rozwiązania, które dobrze pasuje do tego problemu.
              Zapisaliśmy go na mapie potrzeb Małopolski — dzięki temu ROPS wie, gdzie szukać nowych pomysłów.
            </p>
            <p>Masz pomysł, jak to rozwiązać? Pomożemy go opisać.</p>
          </CardContent>
          <CardFooter>
            <Button asChild size="lg"><Link href={`/pomysl?potrzeba=${need.statusCode}`}>Zgłoś pomysł</Link></Button>
          </CardFooter>
        </Card>
      ) : (
        <ol className="space-y-4">
          {matches.map((m) => <li key={m.matchId}><MatchCard match={m} statusCode={need.statusCode} /></li>)}
        </ol>
      )}

      {similarNeeds.count > 0 && (
        <section aria-labelledby="podobne" className="rounded-lg border bg-muted/40 p-5">
          <h2 id="podobne" className="flex items-center gap-2 text-xl font-semibold">
            <UsersIcon aria-hidden className="size-5" />
            {similarNeeds.count} {plural(similarNeeds.count, "inna gmina zgłosiła", "inne gminy zgłosiły", "innych gmin zgłosiło")} podobny problem
          </h2>
          <p className="mt-2">{similarNeeds.gminy.slice(0, 6).join(", ")}{similarNeeds.gminy.length > 6 ? " i inne" : ""}.</p>
          <p className="mt-1 text-muted-foreground">Razem łatwiej znaleźć rozwiązanie i pieniądze na nie.</p>
          <Button asChild variant="outline" className="mt-3">
            <Link href={`/zapytaj?potrzeba=${need.statusCode}&partnerstwo=1`}>Połącz się z tymi gminami</Link>
          </Button>
        </section>
      )}

      {calls.length > 0 && (
        <section aria-labelledby="nabory" className="space-y-3">
          <h2 id="nabory" className="text-xl font-semibold">Otwarte nabory, które mogą pasować</h2>
          <ul className="space-y-2">
            {calls.map((c) => (
              <li key={c.id} className="rounded-lg border p-4">
                <p className="font-medium">{c.title}</p>
                {c.closesAt && <p className="text-muted-foreground">Wnioski do {formatDate(c.closesAt)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {experts.length > 0 && (
        <section aria-labelledby="eksperci" className="space-y-3">
          <h2 id="eksperci" className="text-xl font-semibold">Eksperci, którzy mogą pomóc</h2>
          <ul className="space-y-2">
            {experts.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{e.name}</p>
                  <p className="line-clamp-2 text-muted-foreground">{e.description}</p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/zapytaj?ekspert=${e.id}&potrzeba=${need.statusCode}`}>Zapytaj eksperta</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button variant="outline" size="lg" onClick={onReset}>Opisz inny problem</Button>
    </div>
  );
}

function StatusCodeBox({ code }: { code: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed p-4">
      <p className="text-lg">
        Twój kod zgłoszenia: <strong className="font-mono text-2xl tracking-wider whitespace-nowrap">{code}</strong>
      </p>
      <p className="text-muted-foreground">
        Zapisz go. Po tym kodzie sprawdzisz, co dzieje się z Twoim zgłoszeniem — bez zakładania konta.{" "}
        <Link href={`/status/${code}`} className="underline underline-offset-4">Sprawdź status</Link>
      </p>
    </div>
  );
}

function MatchCard({ match: m, statusCode }: { match: InnovationMatch; statusCode: string }) {
  const titleId = `m-${m.matchId}`;
  return (
    <Card aria-labelledby={titleId}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{fitLabel(m.fit)} · {m.fit}/100</Badge>
          {m.category && <Badge variant="outline">{m.category}</Badge>}
        </div>
        <h3 id={titleId} className="text-xl leading-snug font-semibold">{m.title}</h3>
      </CardHeader>
      <CardContent className="space-y-2 text-base">
        {m.etrSummary && <p>{m.etrSummary}</p>}
        <p><strong>Dlaczego pasuje:</strong> {m.why}</p>
        <p><strong>Co dostosować u Ciebie:</strong> {m.adapt}</p>
        {m.testsCount > 0 && (
          <p className="text-muted-foreground">
            Przetestowano {m.testsCount} {plural(m.testsCount, "raz", "razy", "razy")}
            {m.avgRating != null && `, średnia ocena ${formatNumber(m.avgRating)} na 5`}.
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href={`/wdrozenie?innowacja=${m.id}&potrzeba=${statusCode}`}>Jak to wdrożyć u nas?</Link></Button>
          <Button asChild variant="outline"><Link href={`/przetestuj?innowacja=${m.id}`}>Chcę przetestować</Link></Button>
          <Button asChild variant="outline"><Link href={`/zapytaj?innowacja=${m.id}&potrzeba=${statusCode}`}>Zapytaj eksperta</Link></Button>
        </div>
        <FeedbackButtons matchId={m.matchId} />
      </CardFooter>
    </Card>
  );
}

function FeedbackButtons({ matchId }: { matchId: string }) {
  const [value, setValue] = useState<1 | -1 | 0>(0);
  const [error, setError] = useState(false);

  async function send(v: 1 | -1) {
    const next = value === v ? 0 : v; // drugie kliknięcie cofa ocenę
    const prev = value;
    setValue(next);
    setError(false);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, value: next }),
    }).catch(() => null);
    if (!res?.ok) { setValue(prev); setError(true); }
  }

  return (
    <div role="group" aria-label="Czy to rozwiązanie jest pomocne?" className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground">Czy to pomocne?</span>
      <Button type="button" size="sm" variant={value === 1 ? "default" : "ghost"} aria-pressed={value === 1} onClick={() => send(1)}>
        <ThumbsUpIcon aria-hidden /> Tak
      </Button>
      <Button type="button" size="sm" variant={value === -1 ? "default" : "ghost"} aria-pressed={value === -1} onClick={() => send(-1)}>
        <ThumbsDownIcon aria-hidden /> Nie
      </Button>
      <span aria-live="polite" className="text-sm">
        {error ? "Nie udało się zapisać oceny." : value !== 0 ? "Dziękujemy za ocenę." : ""}
      </span>
    </div>
  );
}
