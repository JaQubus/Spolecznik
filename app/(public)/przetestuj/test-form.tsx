"use client";

import Link from "next/link";
import { innovationHref } from "@/lib/knowledge/hrefs";
import { useEffect, useRef, useState } from "react";
import { EMPTY_GMINA, GminaField, type GminaValue } from "@/components/gmina-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { GminaOption } from "@/lib/gminy";

type Status = "planowany" | "zakonczony";

// Ocena jako opisane przyciski radiowe, nie gwiazdki (README §9).
const RATINGS = [
  { value: 1, label: "1 — nie sprawdziło się" },
  { value: 2, label: "2 — słabo" },
  { value: 3, label: "3 — średnio" },
  { value: 4, label: "4 — dobrze" },
  { value: 5, label: "5 — bardzo dobrze" },
];

const selectClass =
  "h-14 w-full rounded-lg border-2 border-input bg-background px-4 text-lg hover:border-foreground aria-invalid:border-[3px] aria-invalid:border-destructive";

type Errors = Partial<Record<"innovation" | "gmina" | "rating", string>>;

export function TestForm({
  innovations,
  gminy,
  initialInnovation,
}: {
  innovations: { id: string; title: string; slug: string | null }[];
  gminy: GminaOption[];
  initialInnovation: string;
}) {
  const [innovationId, setInnovationId] = useState(initialInnovation);
  const [status, setStatus] = useState<Status>("planowany");
  const [gmina, setGmina] = useState<GminaValue>(EMPTY_GMINA);
  const [testerOrg, setTesterOrg] = useState("");
  const [plannedFor, setPlannedFor] = useState("");
  const [rating, setRating] = useState("");
  const [feedback, setFeedback] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const innovationField = useRef<HTMLSelectElement>(null);
  const gminaField = useRef<HTMLInputElement>(null);
  const ratingGroup = useRef<HTMLDivElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const doneBox = useRef<HTMLDivElement>(null);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  useEffect(() => { if (done) doneBox.current?.focus(); }, [done]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!innovationId) next.innovation = "Wybierz rozwiązanie z listy.";
    if (gmina.text.trim().length < 2) next.gmina = "Wpisz nazwę gminy, np. „Bobowa”.";
    if (status === "zakonczony" && !rating) next.rating = "Wybierz ocenę od 1 do 5.";
    setErrors(next);
    if (next.innovation) return innovationField.current?.focus();
    if (next.gmina) return gminaField.current?.focus();
    if (next.rating) return ratingGroup.current?.querySelector<HTMLButtonElement>("button")?.focus();

    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          innovationId,
          gmina: gmina.text.trim(),
          teryt: gmina.teryt ?? undefined,
          status,
          testerOrg: testerOrg || undefined,
          plannedFor: plannedFor || undefined,
          rating: status === "zakonczony" ? Number(rating) : undefined,
          feedback: feedback || undefined,
          suggestions: suggestions || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się zapisać");
      setDone(json.gmina as string);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie.`);
    } finally {
      setBusy(false);
    }
  }

  const innovation = innovations.find((i) => i.id === innovationId);

  if (done) {
    return (
      <div className="space-y-4">
        <Alert ref={doneBox} tabIndex={-1} tone="success" title={status === "zakonczony" ? "Dziękujemy za ocenę" : "Zapisaliśmy test"}>
          <p>
            {status === "zakonczony"
              ? `Ocena z gminy ${done} jest już widoczna na karcie rozwiązania i pomoże innym gminom.`
              : `Test w gminie ${done} jest zapisany. Po teście wróć tu i oceń, jak poszło.`}
          </p>
        </Alert>
        {innovation?.slug && (
          <Button asChild variant="outline"><Link href={innovationHref(innovation.slug)}>Wróć do opisu rozwiązania</Link></Button>
        )}
      </div>
    );
  }

  const describe = (id: string, hint: boolean, err?: string) => [hint && `${id}-pomoc`, err && `${id}-blad`].filter(Boolean).join(" ") || undefined;

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
          aria-describedby={describe("innowacja", false, errors.innovation)}
          className={selectClass}
        >
          <option value="">Wybierz z Biblioteki…</option>
          {innovations.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-bold">Co chcesz zrobić</legend>
        <RadioGroup value={status} onValueChange={(v) => setStatus(v as Status)}>
          <RadioGroupOption id="status-planowany" value="planowany" label="Chcę przetestować to rozwiązanie" />
          <RadioGroupOption id="status-zakonczony" value="zakonczony" label="Test już się odbył — chcę go ocenić" />
        </RadioGroup>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="gmina">Gmina, w której {status === "zakonczony" ? "był" : "będzie"} test</Label>
        <FieldError id="gmina-blad">{errors.gmina}</FieldError>
        <GminaField
          ref={gminaField}
          id="gmina"
          options={gminy}
          value={gmina}
          onValueChange={setGmina}
          aria-invalid={!!errors.gmina}
          aria-describedby={describe("gmina", false, errors.gmina)}
        />
      </div>

      {status === "planowany" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="kto">Kto testuje</Label>
            <FieldHint id="kto-pomoc">Nazwa instytucji albo organizacji, np. „GOPS w Bobowej”. Bez nazwisk.</FieldHint>
            <Input id="kto" value={testerOrg} onChange={(e) => setTesterOrg(e.target.value)} aria-describedby="kto-pomoc" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kiedy">Kiedy chcesz zacząć</Label>
            <Input id="kiedy" type="date" value={plannedFor} onChange={(e) => setPlannedFor(e.target.value)} className="max-w-xs" />
          </div>
        </>
      ) : (
        <>
          <fieldset className="space-y-2" aria-describedby={errors.rating ? "ocena-blad" : undefined}>
            <legend className="font-bold">Jak oceniasz rozwiązanie</legend>
            <FieldError id="ocena-blad">{errors.rating}</FieldError>
            <div ref={ratingGroup}>
              <RadioGroup value={rating} onValueChange={setRating} aria-invalid={!!errors.rating}>
                {RATINGS.map((r) => <RadioGroupOption key={r.value} id={`ocena-${r.value}`} value={String(r.value)} label={r.label} />)}
              </RadioGroup>
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="co-dziala">Co zadziałało</Label>
            <Textarea id="co-dziala" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-poprawic">Co warto poprawić</Label>
            <Textarea id="co-poprawic" rows={3} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
          </div>
        </>
      )}

      <p aria-live="polite" className="text-muted-foreground">{busy ? "Zapisuję…" : ""}</p>
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {status === "zakonczony" ? "Wyślij ocenę" : "Zgłoś test"}
      </Button>
    </form>
  );
}
