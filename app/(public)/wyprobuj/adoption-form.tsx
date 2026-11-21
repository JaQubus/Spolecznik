"use client";

import Link from "next/link";
import { initiativeHref, patternHref } from "@/lib/knowledge/hrefs";
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
import type { SourceOption } from "@/lib/patterns";
import { org } from "@/lib/brand";

type Status = "planowany" | "zakonczony";

// Ocena jako opisane przyciski radiowe, nie gwiazdki.
const RATINGS = [
  { value: 1, label: "1 — nie sprawdziło się" },
  { value: 2, label: "2 — słabo" },
  { value: 3, label: "3 — średnio" },
  { value: 4, label: "4 — dobrze" },
  { value: 5, label: "5 — bardzo dobrze" },
];

const selectClass =
  "h-14 w-full rounded-lg border-2 border-input bg-background px-4 text-lg hover:border-foreground aria-invalid:border-[3px] aria-invalid:border-destructive";

type Errors = Partial<Record<"source" | "gmina" | "rating" | "email", string>>;

const sourceValue = (o: Pick<SourceOption, "kind" | "id">) => `${o.kind}:${o.id}`;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdoptionForm({
  sources,
  gminy,
  initialSource,
}: {
  sources: SourceOption[];
  gminy: GminaOption[];
  initialSource: SourceOption | null;
}) {
  const [source, setSource] = useState(initialSource ? sourceValue(initialSource) : "");
  const [status, setStatus] = useState<Status>("planowany");
  const [gmina, setGmina] = useState<GminaValue>(EMPTY_GMINA);
  const [adopterOrg, setAdopterOrg] = useState("");
  const [plannedFor, setPlannedFor] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState("");
  const [worked, setWorked] = useState("");
  const [improve, setImprove] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const sourceField = useRef<HTMLSelectElement>(null);
  const gminaField = useRef<HTMLInputElement>(null);
  const emailField = useRef<HTMLInputElement>(null);
  const ratingGroup = useRef<HTMLDivElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const doneBox = useRef<HTMLDivElement>(null);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  useEffect(() => { if (done) doneBox.current?.focus(); }, [done]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    const chosen = sources.find((o) => sourceValue(o) === source);
    if (!chosen) next.source = "Wybierz z listy, co przenosicie.";
    if (gmina.text.trim().length < 2) next.gmina = "Wpisz nazwę gminy, np. „Dynów”.";
    if (status === "zakonczony" && !rating) next.rating = "Wybierz ocenę od 1 do 5.";
    if (status === "planowany" && email.trim() && !EMAIL.test(email.trim())) next.email = "Wpisz adres e-mail, np. szkola@dynow.pl, albo zostaw pole puste.";
    setErrors(next);
    if (next.source || !chosen) return sourceField.current?.focus();
    if (next.gmina) return gminaField.current?.focus();
    if (next.rating) return ratingGroup.current?.querySelector<HTMLButtonElement>("button")?.focus();
    if (next.email) return emailField.current?.focus();

    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/adoptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiativeId: chosen.kind === "initiative" ? chosen.id : undefined,
          patternId: chosen.kind === "pattern" ? chosen.id : undefined,
          gmina: gmina.text.trim(),
          teryt: gmina.teryt ?? undefined,
          status,
          adopterOrg: adopterOrg || undefined,
          plannedFor: plannedFor || undefined,
          contactEmail: status === "planowany" && email.trim() ? email.trim() : undefined,
          rating: status === "zakonczony" ? Number(rating) : undefined,
          worked: worked || undefined,
          improve: improve || undefined,
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

  const chosen = sources.find((o) => sourceValue(o) === source);
  const backHref = chosen ? (chosen.kind === "initiative" ? (chosen.slug ? initiativeHref(chosen.slug) : null) : patternHref(chosen.slug ?? chosen.id)) : null;

  if (done) {
    return (
      <div className="space-y-4">
        <Alert ref={doneBox} tabIndex={-1} tone="success" title={status === "zakonczony" ? "Dziękujemy za ocenę" : "Zapisaliśmy przeniesienie"}>
          <p>
            {status === "zakonczony"
              ? `Ocena z gminy ${done} jest już widoczna na karcie i pomoże innym gminom. Udane przeniesienie podnosi też ocenę przenaszalności na radarze.`
              : `Przeniesienie w gminie ${done} jest zapisane. Po pilotażu wróć tu i oceń, jak poszło.`}
          </p>
        </Alert>
        {backHref && (
          <Button asChild variant="outline"><Link href={backHref}>Wróć do opisu</Link></Button>
        )}
      </div>
    );
  }

  const describe = (id: string, hint: boolean, err?: string) => [hint && `${id}-pomoc`, err && `${id}-blad`].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-6">
      {error && <Alert ref={errorBox} tabIndex={-1} tone="error" title="Coś poszło nie tak"><p>{error}</p></Alert>}

      <div className="space-y-2">
        <Label htmlFor="zrodlo">Co przenosicie?</Label>
        <FieldError id="zrodlo-blad">{errors.source}</FieldError>
        <select
          ref={sourceField}
          id="zrodlo"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-invalid={!!errors.source}
          aria-describedby={describe("zrodlo", false, errors.source)}
          className={selectClass}
        >
          <option value="">Wybierz…</option>
          <optgroup label="Inicjatywy z regionu">
            {sources.filter((o) => o.kind === "initiative").map((o) => <option key={o.id} value={sourceValue(o)}>{o.title}</option>)}
          </optgroup>
          <optgroup label="Sprawdzone rozwiązania z Polski">
            {sources.filter((o) => o.kind === "pattern").map((o) => <option key={o.id} value={sourceValue(o)}>{o.title}</option>)}
          </optgroup>
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-bold">Co chcesz zrobić</legend>
        <RadioGroup value={status} onValueChange={(v) => setStatus(v as Status)}>
          <RadioGroupOption id="status-planowany" value="planowany" label="Zaczynamy przenosić to do siebie" />
          <RadioGroupOption id="status-zakonczony" value="zakonczony" label="Już to wypróbowaliśmy — chcemy ocenić" />
        </RadioGroup>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="gmina">Gmina, w której {status === "zakonczony" ? "był" : "będzie"} pilotaż</Label>
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
            <Label htmlFor="kto">Kto przenosi</Label>
            <FieldHint id="kto-pomoc">Typ instytucji, np. „szkoła podstawowa” albo „urząd gminy”. Bez nazwisk.</FieldHint>
            <Input id="kto" value={adopterOrg} onChange={(e) => setAdopterOrg(e.target.value)} aria-describedby="kto-pomoc" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kiedy">Kiedy chcesz zacząć</Label>
            <Input id="kiedy" type="date" value={plannedFor} onChange={(e) => setPlannedFor(e.target.value)} className="max-w-xs" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail do powiadomień (nieobowiązkowy)</Label>
            <FieldHint id="email-pomoc">
              Napiszemy, gdy zespół {org.short} potwierdzi pilotaż albo zmieni jego status. Bez konta — adres służy tylko do tego.
            </FieldHint>
            <FieldError id="email-blad">{errors.email}</FieldError>
            <Input
              ref={emailField}
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={describe("email", true, errors.email)}
            />
          </div>
        </>
      ) : (
        <>
          <fieldset className="space-y-2" aria-describedby={errors.rating ? "ocena-blad" : undefined}>
            <legend className="font-bold">Jak się sprawdziło u Was</legend>
            <FieldError id="ocena-blad">{errors.rating}</FieldError>
            <div ref={ratingGroup}>
              <RadioGroup value={rating} onValueChange={setRating} aria-invalid={!!errors.rating}>
                {RATINGS.map((r) => <RadioGroupOption key={r.value} id={`ocena-${r.value}`} value={String(r.value)} label={r.label} />)}
              </RadioGroup>
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="co-dziala">Co zadziałało</Label>
            <Textarea id="co-dziala" rows={3} value={worked} onChange={(e) => setWorked(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-poprawic">Co warto poprawić</Label>
            <Textarea id="co-poprawic" rows={3} value={improve} onChange={(e) => setImprove(e.target.value)} />
          </div>
        </>
      )}

      <p aria-live="polite" className="text-muted-foreground">{busy ? "Zapisuję…" : ""}</p>
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {status === "zakonczony" ? "Wyślij ocenę" : "Zapisz przeniesienie"}
      </Button>
    </form>
  );
}
