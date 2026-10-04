"use client";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/**
 * Błąd przy wyświetlaniu strony (np. baza albo AI chwilowo nie odpowiada). Zamiast domyślnego
 * „Application error” Next.js: co się stało, co zrobić i dokąd pójść. Nagłówek z menu zostaje (root layout).
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
    heading.current?.focus();
  }, [error]);

  return (
    <section className="max-w-2xl space-y-6">
      <title>Coś poszło nie tak · Społecznik</title>
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold outline-none">Coś poszło nie tak</h1>
      <Alert tone="error" title="Nie udało się wczytać tej strony">
        <p>
          To zwykle chwilowy problem z połączeniem z bazą danych albo z AI. Odczekaj chwilę i spróbuj ponownie.
        </p>
      </Alert>
      <Button type="button" onClick={() => retry()} className="w-full sm:w-auto">
        <ArrowPathIcon aria-hidden />
        Spróbuj ponownie
      </Button>
      <ul className="space-y-3">
        <li><Link href="/" className={linkClass}>Przejdź na stronę główną</Link></li>
        <li><Link href="/biblioteka" className={linkClass}>Biblioteka i wiedza</Link></li>
        <li><Link href="/status" className={linkClass}>Sprawdź status zgłoszenia</Link></li>
      </ul>
      {error.digest && <p className="text-base text-muted-foreground">Numer błędu dla ROPS: <span className="font-mono">{error.digest}</span></p>}
    </section>
  );
}
