"use client";

import { PrinterIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GminaField, type GminaValue } from "@/components/gmina-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import type { GminaOption } from "@/lib/gminy";
import { formatNumber } from "@/lib/pl";
import type { ImplementationCard } from "@/lib/schemas";

type Result = {
  innovation: { id: string; title: string };
  gmina: { teryt: string; nazwa: string };
  card: Omit<ImplementationCard, "partners"> & { partners: { id: string; role: string; name: string }[] };
};

// Natywna lista wyboru wygląda jak pole tekstowe (TextField.md): ramka 2px, 56px wysokości.
const selectClass =
  "h-14 w-full rounded-lg border-2 border-input bg-background px-4 text-lg hover:border-foreground aria-invalid:border-[3px] aria-invalid:border-destructive";

const zl = (n: number) => `${formatNumber(Math.round(n), 0)} zł`;

export function ImplementationFlow({
  innovations,
  gminy,
  initialInnovation,
  initialGmina,
}: {
  innovations: { id: string; title: string }[];
  gminy: GminaOption[];
  initialInnovation: string;
  initialGmina: GminaValue;
}) {
  const [innovationId, setInnovationId] = useState(initialInnovation);
  const [gmina, setGmina] = useState<GminaValue>(initialGmina);
  const [errors, setErrors] = useState<{ innovation?: string; gmina?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const innovationField = useRef<HTMLSelectElement>(null);
  const gminaField = useRef<HTMLInputElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  useEffect(() => { if (result) heading.current?.focus(); }, [result]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!innovationId) next.innovation = "Wybierz rozwiązanie z listy.";
    if (gmina.text.trim().length < 2) next.gmina = "Wpisz nazwę gminy, np. „Bobowa”.";
    setErrors(next);
    if (next.innovation) return innovationField.current?.focus();
    if (next.gmina) return gminaField.current?.focus();

    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/middleman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ innovationId, gmina: gmina.text.trim(), teryt: gmina.teryt ?? undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się przygotować karty");
      setResult(json as Result);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie.`);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const c = result.card;
    return (
      <article className="space-y-10">
        <div className="space-y-2">
          <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
            {result.innovation.title} w gminie {result.gmina.nazwa}
          </h2>
          <p className="text-muted-foreground">Karta powstała z opisu rozwiązania i danych o gminie. To punkt wyjścia do rozmowy, nie gotowy plan.</p>
        </div>

        <dl className="grid max-w-[68ch] gap-1">
          <dt className="font-bold">Cel</dt><dd className="mb-4">{c.goal}</dd>
          <dt className="font-bold">Kto skorzysta w Twojej gminie</dt><dd className="mb-4">{c.audience}</dd>
          <dt className="font-bold">Forma usługi</dt><dd className="mb-4">{c.serviceForm}</dd>
          <dt className="font-bold">Ludzie i zasoby</dt><dd className="mb-4">{c.staffAndResources}</dd>
          <dt className="font-bold">Koszt w pierwszym roku (szacunek)</dt>
          <dd className="mb-4">od {zl(c.costEstimate.minPln)} do {zl(c.costEstimate.maxPln)}. {c.costEstimate.basis}</dd>
        </dl>

        <section aria-labelledby="kroki" className="max-w-[68ch] space-y-2">
          <h3 id="kroki" className="text-xl font-bold">Kroki</h3>
          <ol className="list-decimal space-y-1 pl-6">{c.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>

        {c.partners.length > 0 && (
          <section aria-labelledby="partnerzy" className="max-w-[68ch] space-y-2">
            <h3 id="partnerzy" className="text-xl font-bold">Kto może pomóc</h3>
            <ul className="divide-y border-y">
              {c.partners.map((p) => (
                <li key={p.id} className="py-3"><p className="font-bold">{p.name}</p><p className="text-muted-foreground">{p.role}</p></li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid max-w-[68ch] gap-8 md:grid-cols-2">
          {c.risks.length > 0 && (
            <section aria-labelledby="ryzyka" className="space-y-2">
              <h3 id="ryzyka" className="text-xl font-bold">Na co uważać</h3>
              <ul className="list-disc space-y-1 pl-6">{c.risks.map((r) => <li key={r}>{r}</li>)}</ul>
            </section>
          )}
          {c.successIndicators.length > 0 && (
            <section aria-labelledby="wskazniki" className="space-y-2">
              <h3 id="wskazniki" className="text-xl font-bold">Po czym poznać, że działa</h3>
              <ul className="list-disc space-y-1 pl-6">{c.successIndicators.map((r) => <li key={r}>{r}</li>)}</ul>
            </section>
          )}
        </div>

        {c.assumptions.length > 0 && (
          <Alert title="Założenia, których nie sprawdziliśmy">
            <ul className="list-disc space-y-1 pl-6">{c.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Button asChild variant="outline"><Link href={`/przetestuj?innowacja=${result.innovation.id}`}>Chcę przetestować</Link></Button>
          <Button type="button" variant="link" onClick={() => window.print()}><PrinterIcon aria-hidden className="size-4" /> Wydrukuj kartę</Button>
          <Button type="button" variant="link" onClick={() => setResult(null)}>Inna gmina albo rozwiązanie</Button>
        </div>
      </article>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-6">
      {error && <Alert ref={errorBox} tabIndex={-1} tone="error" title="Coś poszło nie tak"><p>{error}</p></Alert>}
      <div className="space-y-2">
        <Label htmlFor="innowacja">Rozwiązanie</Label>
        <FieldError id="innowacja-blad">{errors.innovation}</FieldError>
        <select
          ref={innovationField}
          id="innowacja"
          value={innovationId}
          onChange={(e) => setInnovationId(e.target.value)}
          aria-invalid={!!errors.innovation}
          aria-describedby={errors.innovation ? "innowacja-blad" : undefined}
          className={selectClass}
        >
          <option value="">Wybierz z Biblioteki…</option>
          {innovations.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="gmina">Twoja gmina</Label>
        <FieldHint id="gmina-pomoc">Weźmiemy pod uwagę liczbę mieszkańców, seniorów i zmianę liczby ludności.</FieldHint>
        <FieldError id="gmina-blad">{errors.gmina}</FieldError>
        <GminaField
          ref={gminaField}
          id="gmina"
          options={gminy}
          value={gmina}
          onValueChange={setGmina}
          aria-invalid={!!errors.gmina}
          aria-describedby={errors.gmina ? "gmina-pomoc gmina-blad" : "gmina-pomoc"}
        />
      </div>
      <p aria-live="polite" className="text-muted-foreground">{busy ? "Przygotowuję kartę. To może potrwać kilkanaście sekund." : ""}</p>
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">Przygotuj kartę wdrożeniową</Button>
    </form>
  );
}
