"use client";

import { HandThumbDownIcon, HandThumbUpIcon, UsersIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { innovationHref } from "@/lib/knowledge/hrefs";
import { useEffect, useRef, useState } from "react";
import { EmailOptIn } from "@/components/rozmowa/email-opt-in";
import { PrivateLink } from "@/components/rozmowa/private-link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber, plural } from "@/lib/pl";
import type { InnovationMatch, MatchResponse, NeedCard } from "@/lib/schemas";
import { AREA_LABELS } from "@/lib/taxonomy";

function fitLabel(fit: number): string {
  if (fit >= 80) return "Bardzo dobrze pasuje";
  if (fit >= 65) return "Dobrze pasuje";
  return "Może pasować";
}

const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

export function MatchResults({ card, result, onReset }: { card: NeedCard; result: MatchResponse; onReset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Po pojawieniu się wyników przenosimy fokus na nagłówek — czytnik ekranu od razu odczyta ich liczbę.
  useEffect(() => heading.current?.focus(), []);

  const { need, matches, isGap, similarNeeds, experts, calls } = result;
  const n = matches.length;

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
          {isGap ? "Nie znaleźliśmy jeszcze gotowego rozwiązania" : `Znaleźliśmy ${n} ${plural(n, "rozwiązanie", "rozwiązania", "rozwiązań")}`}
        </h2>
        <p className="max-w-[68ch] text-lg"><strong>Zrozumieliśmy tak:</strong> {card.summary}</p>
        <ul className="flex flex-wrap gap-2" aria-label="Obszary">
          {card.areas.slice(0, 3).map((a) => <li key={a}><Badge>{AREA_LABELS[a]}</Badge></li>)}
        </ul>
      </div>

      <StatusCode code={need.statusCode} accessKey={need.accessKey} />

      {isGap ? (
        // Luka: komunikat + jedyny zielony przycisk na ekranie (ResultList.md).
        <div className="space-y-4">
          <Alert title="To ważna informacja">
            <p>
              W bibliotece nie ma jeszcze rozwiązania, które dobrze pasuje do tego problemu.
              Zapisaliśmy go na mapie potrzeb Małopolski — dzięki temu ROPS wie, gdzie szukać nowych pomysłów.
            </p>
            <p>Masz pomysł, jak to rozwiązać? Pomożemy go opisać.</p>
          </Alert>
          <Button asChild className="w-full sm:w-auto"><Link href={`/pomysl?potrzeba=${need.statusCode}`}>Zgłoś pomysł</Link></Button>
        </div>
      ) : (
        <ol className="max-w-3xl">
          {matches.map((m) => <ResultRow key={m.matchId} match={m} statusCode={need.statusCode} />)}
        </ol>
      )}

      {similarNeeds.count > 0 && (
        <section aria-labelledby="podobne" className="max-w-3xl space-y-3">
          <h2 id="podobne" className="flex items-center gap-2 text-xl font-bold">
            <UsersIcon aria-hidden className="size-6 shrink-0" />
            {similarNeeds.count} {plural(similarNeeds.count, "inna gmina zgłosiła", "inne gminy zgłosiły", "innych gmin zgłosiło")} podobny problem
          </h2>
          <p>{similarNeeds.gminy.slice(0, 6).join(", ")}{similarNeeds.gminy.length > 6 ? " i inne" : ""}.</p>
          <p className="text-muted-foreground">Razem łatwiej znaleźć rozwiązanie i pieniądze na nie.</p>
          <Button asChild variant="outline">
            <Link href={`/zapytaj?potrzeba=${need.statusCode}&partnerstwo=1`}>Połącz się z tymi gminami</Link>
          </Button>
        </section>
      )}

      {calls.length > 0 && (
        <section aria-labelledby="nabory" className="max-w-3xl space-y-3">
          <h2 id="nabory" className="text-xl font-bold">Otwarte nabory, które mogą pasować</h2>
          <ul className="divide-y border-y">
            {calls.map((c) => (
              <li key={c.id} className="py-4">
                <p className="font-bold">{c.title}</p>
                {c.closesAt && <p className="text-muted-foreground">Wnioski do {formatDate(c.closesAt)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {experts.length > 0 && (
        <section aria-labelledby="eksperci" className="max-w-3xl space-y-3">
          <h2 id="eksperci" className="text-xl font-bold">Eksperci, którzy mogą pomóc</h2>
          <ul className="divide-y border-y">
            {experts.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-bold">{e.name}</p>
                  <p className="line-clamp-2 text-muted-foreground">{e.description}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/zapytaj?ekspert=${e.id}&potrzeba=${need.statusCode}`}>Zapytaj eksperta</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button variant="outline" onClick={onReset}>Opisz inny problem</Button>
    </div>
  );
}

/** Kod zgłoszenia w stylu „kod do przepisania” (Atkinson Mono) na kremowym tle, bez ramki. */
function StatusCode({ code, accessKey }: { code: string; accessKey: string }) {
  return (
    <div className="max-w-[44rem] space-y-4 rounded-[16px] bg-secondary px-5 py-4">
      <div className="space-y-1">
        <p className="text-lg">
          Twój kod zgłoszenia: <strong className="font-mono text-2xl tracking-wider whitespace-nowrap">{code}</strong>
        </p>
        <p>
          Zapisz go. Po tym kodzie sprawdzisz, co dzieje się z Twoim zgłoszeniem — bez zakładania konta.{" "}
          <Link href={`/status/${code}`} className={linkClass}>Sprawdź status</Link>
        </p>
        <p>
          Rozmowa z ekspertem jest prywatna. Ta przeglądarka ją zapamięta — znajdziesz ją w{" "}
          <Link href="/zapytaj" className={linkClass}>Zapytaj eksperta</Link>.
        </p>
      </div>
      <PrivateLink code={code} accessKey={accessKey} />
      <EmailOptIn code={code} accessKey={accessKey} />
    </div>
  );
}

/** Wiersz ResultList: tytuł, dopasowanie słowami, uzasadnienie w <dl>, trzy akcje z README §5.1: jedna drugorzędna i dwie ciche. */
function ResultRow({ match: m, statusCode }: { match: InnovationMatch; statusCode: string }) {
  return (
    <li className="grid gap-3 border-b py-8 first:pt-0">
      {/* Tytuł prowadzi do pełnego opisu (problem, rozwiązanie, skąd wiemy, że działa); link, nie kolejny przycisk. */}
      <h3 className="text-xl font-bold">
        <Link href={innovationHref(m.slug ?? m.id)} className="underline decoration-1 underline-offset-4 hover:decoration-2">{m.title}</Link>
      </h3>
      <div className="flex flex-wrap items-center gap-3 text-base text-muted-foreground">
        {/* Pasek jest ozdobą; liczba jest zawsze napisana słowami. */}
        <span aria-hidden className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-foreground" style={{ width: `${m.fit}%` }} />
        </span>
        <span><strong className="text-foreground">{fitLabel(m.fit)}</strong> · dopasowanie {m.fit} na 100</span>
        {m.category && <Badge>{m.category}</Badge>}
      </div>
      {m.etrSummary && <p className="max-w-[68ch]">{m.etrSummary}</p>}
      <dl className="grid max-w-[68ch] gap-1">
        <dt className="mt-2 font-bold">Dlaczego pasuje</dt>
        <dd>{m.why}</dd>
        <dt className="mt-2 font-bold">Co dostosować u Ciebie</dt>
        <dd>{m.adapt}</dd>
      </dl>
      {m.testsCount > 0 && (
        <p className="text-base text-muted-foreground">
          Przetestowano {m.testsCount} {plural(m.testsCount, "raz", "razy", "razy")}
          {m.avgRating != null && `, średnia ocena ${formatNumber(m.avgRating)} na 5`}.
        </p>
      )}
      {/* Jedna akcja z obrysem, reszta jako linki: dziesięć wyników nie może dać dziesięciu zielonych przycisków. */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline"><Link href={`/wdrozenie?innowacja=${m.id}&potrzeba=${statusCode}`}>Jak to wdrożyć u nas?</Link></Button>
        <Button asChild variant="link"><Link href={`/przetestuj?innowacja=${m.id}`}>Chcę przetestować</Link></Button>
        <Button asChild variant="link"><Link href={`/zapytaj?innowacja=${m.id}&potrzeba=${statusCode}`}>Zapytaj eksperta</Link></Button>
      </div>
      <FeedbackButtons matchId={m.matchId} />
    </li>
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

  // Wciśnięty = wypełnienie kolorem tekstu (jak filtry), nie zieleń.
  const toggle = "aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:hover:bg-foreground";
  return (
    <div role="group" aria-label="Czy to rozwiązanie jest pomocne?" className="flex flex-wrap items-center gap-2">
      <span className="text-base text-muted-foreground">Czy to pomocne?</span>
      <Button type="button" size="sm" variant="outline" aria-pressed={value === 1} onClick={() => send(1)} className={toggle}>
        <HandThumbUpIcon aria-hidden /> Tak
      </Button>
      <Button type="button" size="sm" variant="outline" aria-pressed={value === -1} onClick={() => send(-1)} className={toggle}>
        <HandThumbDownIcon aria-hidden /> Nie
      </Button>
      <span aria-live="polite" className="text-base">
        {error ? "Nie udało się zapisać oceny." : value !== 0 ? "Dziękujemy za ocenę." : ""}
      </span>
    </div>
  );
}
