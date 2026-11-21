"use client";

import { HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useState } from "react";
import { EmailOptIn } from "@/components/rozmowa/email-opt-in";
import { PrivateLink } from "@/components/rozmowa/private-link";
import { Button } from "@/components/ui/button";
import { initiativeHref, patternHref } from "@/lib/knowledge/hrefs";
import { formatDate, formatNumber, plural } from "@/lib/pl";
import type { Match, MentorHit, ProgramHit } from "@/lib/schemas";

export const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

function fitLabel(fit: number): string {
  if (fit >= 80) return "Bardzo dobrze pasuje";
  if (fit >= 65) return "Dobrze pasuje";
  return "Może pasować";
}

/** Kod zgłoszenia w stylu „kod do przepisania” (Atkinson Mono) na kremowym tle, bez ramki. */
export function StatusCode({ code, accessKey }: { code: string; accessKey: string }) {
  return (
    <div className="max-w-[44rem] space-y-4 rounded-[16px] bg-secondary px-5 py-4">
      <div className="space-y-1">
        <p className="text-lg">
          Twój kod zgłoszenia: <strong className="font-mono text-2xl tracking-wider whitespace-nowrap">{code}</strong>
        </p>
        <p>
          Zapisz go. Po tym kodzie sprawdzisz, co dzieje się ze zgłoszeniem — bez zakładania konta.{" "}
          <Link href={`/status/${code}`} className={linkClass}>Sprawdź status</Link>
        </p>
        <p>
          Rozmowa z zespołem jest prywatna. Ta przeglądarka ją zapamięta — znajdziesz ją w{" "}
          <Link href="/rozmowy" className={linkClass}>Rozmowach</Link>.
        </p>
      </div>
      <PrivateLink code={code} accessKey={accessKey} />
      <EmailOptIn code={code} accessKey={accessKey} />
    </div>
  );
}

const hrefOf = (m: Match) => (m.kind === "initiative" ? (m.slug ? initiativeHref(m.slug) : null) : patternHref(m.slug ?? m.id));
const sourceParam = (m: Match) => (m.kind === "initiative" ? `inicjatywa=${m.slug ?? m.id}` : `rozwiazanie=${m.slug ?? m.id}`);

/** Wiersz wyniku: tytuł, dopasowanie słowami, uzasadnienie w <dl>, akcje: jedna z obrysem, reszta jako linki. */
export function MatchRow({ match: m, heading = 3 }: { match: Match; heading?: 3 | 4 }) {
  const H = `h${heading}` as const;
  const href = hrefOf(m);
  return (
    <li className="grid gap-3 border-b py-8 first:pt-0">
      <p className="text-base text-muted-foreground">
        {m.kind === "initiative" ? `Inicjatywa z regionu${m.gmina ? ` · ${m.gmina}` : ""}` : "Sprawdzone rozwiązanie z Polski"}
      </p>
      <H className="text-xl font-bold">
        {href ? <Link href={href} className="underline decoration-1 underline-offset-4 hover:decoration-2">{m.title}</Link> : m.title}
      </H>
      <div className="flex flex-wrap items-center gap-3 text-base text-muted-foreground">
        {/* Pasek jest ozdobą; liczba jest zawsze napisana słowami. */}
        <span aria-hidden className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-foreground" style={{ width: `${m.fit}%` }} />
        </span>
        <span><strong className="text-foreground">{fitLabel(m.fit)}</strong> · dopasowanie {m.fit} na 100</span>
      </div>
      {m.summary && <p className="max-w-[68ch]">{m.summary}</p>}
      <dl className="grid max-w-[68ch] gap-1">
        <dt className="mt-2 font-bold">Dlaczego pasuje</dt>
        <dd>{m.why}</dd>
        <dt className="mt-2 font-bold">Co dostosować u Ciebie</dt>
        <dd>{m.adapt}</dd>
      </dl>
      {m.adoptionsCount > 0 && (
        <p className="text-base text-muted-foreground">
          Przeniesiono w {m.adoptionsCount} {plural(m.adoptionsCount, "miejscu", "miejscach", "miejscach")}
          {m.avgRating != null && `, średnia ocena ${formatNumber(m.avgRating)} na 5`}.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline"><Link href={`/przenies?${sourceParam(m)}`}>Przenieś do siebie</Link></Button>
        <Button asChild variant="link"><Link href={`/wyprobuj?${sourceParam(m)}`}>Wypróbowaliśmy u nas</Link></Button>
      </div>
      {m.matchId && <FeedbackButtons matchId={m.matchId} />}
    </li>
  );
}

export function FeedbackButtons({ matchId }: { matchId: string }) {
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
    <div role="group" aria-label="Czy ten wynik jest pomocny?" className="flex flex-wrap items-center gap-2">
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

/** Mentorzy i otwarte programy pasujące do zgłoszenia. `code` — przy zgłoszeniu: „Zapytaj mentora” w rozmowie. */
export function SupportSections({ mentors, programs, code }: { mentors: MentorHit[]; programs: ProgramHit[]; code?: string }) {
  return (
    <>
      {programs.length > 0 && (
        <section aria-labelledby="programy" className="max-w-3xl space-y-3">
          <h2 id="programy" className="text-xl font-bold">Otwarte programy, które mogą pasować</h2>
          <ul className="divide-y border-y">
            {programs.map((p) => (
              <li key={p.id} className="py-4">
                <p className="font-bold">{p.title}</p>
                {p.closesAt && <p className="text-muted-foreground">Wnioski do {formatDate(p.closesAt)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {mentors.length > 0 && (
        <section aria-labelledby="mentorzy" className="max-w-3xl space-y-3">
          <h2 id="mentorzy" className="text-xl font-bold">Mentorzy, którzy mogą pomóc</h2>
          <ul className="divide-y border-y">
            {mentors.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-bold">{m.name}</p>
                  <p className="line-clamp-2 text-muted-foreground">{m.bio}</p>
                </div>
                {code && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/rozmowy?kod=${code}&mentor=${m.id}`}>Zapytaj mentora</Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
