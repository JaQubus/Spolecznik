"use client";

import { ClipboardDocumentIcon, PrinterIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GminaField, type GminaValue } from "@/components/gmina-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PlanDocument } from "@/components/transfer/plan-document";
import type { GminaOption } from "@/lib/gminy";
import type { SourceOption } from "@/lib/patterns";
import { planToText } from "@/lib/transfer-plan";
import { BUDGET_LABELS, BUDGET_RANGES, type BudgetRange, type PlanDocument as Doc } from "@/lib/schemas";
import { INSTITUTION_KEYS, institutionLabel, type InstitutionKey } from "@/lib/taxonomy";

type Errors = Partial<Record<"source" | "institution" | "gmina" | "audience", string>>;

const sourceValue = (o: Pick<SourceOption, "kind" | "id">) => `${o.kind}:${o.id}`;

/** Groq potrafi myśleć długo nad całym dokumentem; dłużej nie trzymamy użytkownika przy „Przygotowuję…”. */
const TIMEOUT_MS = 90_000;

export function TransferFlow({
  sources,
  gminy,
  initialSource,
  initialGmina,
}: {
  sources: SourceOption[];
  gminy: GminaOption[];
  initialSource: SourceOption | null;
  initialGmina: GminaValue;
}) {
  const [source, setSource] = useState(initialSource ? sourceValue(initialSource) : "");
  // Z karty inicjatywy albo rozwiązania źródło jest już wybrane — listę pokazujemy na żądanie.
  const [choosingSource, setChoosingSource] = useState(!initialSource);
  const [institution, setInstitution] = useState<InstitutionKey | "">("");
  const [gmina, setGmina] = useState<GminaValue>(initialGmina);
  const [audience, setAudience] = useState("");
  const [staff, setStaff] = useState("");
  const [budget, setBudget] = useState<BudgetRange>("nie_wiem");

  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Doc | null>(null);
  const [copied, setCopied] = useState("");
  const sourceField = useRef<HTMLSelectElement>(null);
  const institutionField = useRef<HTMLSelectElement>(null);
  const gminaField = useRef<HTMLInputElement>(null);
  const audienceField = useRef<HTMLInputElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  useEffect(() => { if (result) heading.current?.focus(); }, [result]);

  const chosen = sources.find((o) => sourceValue(o) === source);
  const audienceDigits = audience.replace(/\s/g, "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!chosen) next.source = "Wybierz z listy, co chcesz przenieść.";
    if (!institution) next.institution = "Wybierz, jaką instytucję reprezentujesz.";
    if (gmina.text.trim().length < 2) next.gmina = "Wpisz nazwę gminy, np. „Bobowa”.";
    if (audienceDigits && !/^[1-9]\d{0,6}$/.test(audienceDigits)) next.audience = "Wpisz liczbę osób cyframi, np. 40, albo zostaw puste.";
    setErrors(next);
    if (next.source || !chosen) { setChoosingSource(true); return sourceField.current?.focus(); }
    if (next.institution) return institutionField.current?.focus();
    if (next.gmina) return gminaField.current?.focus();
    if (next.audience) return audienceField.current?.focus();

    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          sourceKind: chosen.kind,
          sourceId: chosen.id,
          gmina: gmina.text.trim(),
          teryt: gmina.teryt ?? undefined,
          institutionType: institution,
          audienceSize: audienceDigits ? Number(audienceDigits) : undefined,
          staff: staff.trim() || undefined,
          budget,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się przygotować planu");
      setCopied("");
      setResult(json as Doc);
    } catch (e) {
      // Formularz zostaje wypełniony: stan żyje w tym komponencie, a błąd tylko dodaje komunikat nad polami.
      const what = e instanceof DOMException && e.name === "TimeoutError"
        ? "Sztuczna inteligencja nie odpowiedziała w ciągu półtorej minuty"
        : e instanceof TypeError
          ? "Nie udało się połączyć z serwerem. Sprawdź połączenie z internetem"
          : e instanceof Error ? e.message : "Coś poszło nie tak";
      setError(`${what}.`);
    } finally {
      setBusy(false);
    }
  }

  async function copy(doc: Doc) {
    try {
      await navigator.clipboard.writeText(planToText(doc));
      setCopied("Skopiowano tekst planu. Możesz go wkleić do edytora tekstu albo wiadomości.");
    } catch {
      setCopied("Nie udało się skopiować. Zaznacz tekst planu i skopiuj go skrótem Ctrl+C.");
    }
  }

  const status = busy
    ? "Przygotowuję plan przeniesienia. To może potrwać do minuty."
    : result ? `Plan przeniesienia gotowy: ${result.source.title} w gminie ${result.gmina.nazwa}.` : "";

  return (
    <div className="space-y-6">
      {result ? (
        <div className="space-y-8">
          <PlanDocument doc={result} headingRef={heading} />
          <div className="space-y-3 print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={() => window.print()}><PrinterIcon aria-hidden className="size-5" /> Drukuj / zapisz PDF</Button>
              <Button type="button" variant="outline" onClick={() => copy(result)}><ClipboardDocumentIcon aria-hidden className="size-5" /> Kopiuj tekst</Button>
              <Button asChild variant="link"><Link href={`/wyprobuj?${result.source.kind === "initiative" ? "inicjatywa" : "rozwiazanie"}=${result.source.id}`}>Wypróbowaliśmy u nas</Link></Button>
              <Button type="button" variant="link" onClick={() => setResult(null)}>Zmień dane w formularzu</Button>
            </div>
            <p aria-live="polite" className="text-base">{copied}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="max-w-2xl space-y-6">
          {error && (
            <Alert ref={errorBox} tabIndex={-1} tone="error" title="Nie udało się przygotować planu">
              <p>{error}</p>
              <p>Twoje odpowiedzi zostały w formularzu. Spróbuj ponownie za minutę, klikając „Przygotuj plan przeniesienia”.</p>
            </Alert>
          )}

          {choosingSource ? (
            <div className="space-y-2">
              <Label htmlFor="zrodlo">Co chcesz przenieść?</Label>
              <FieldError id="zrodlo-blad">{errors.source}</FieldError>
              <NativeSelect
                ref={sourceField}
                id="zrodlo"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                aria-invalid={!!errors.source}
                aria-describedby={errors.source ? "zrodlo-blad" : undefined}
              >
                <option value="">Wybierz…</option>
                <optgroup label="Inicjatywy z regionu">
                  {sources.filter((o) => o.kind === "initiative").map((o) => <option key={o.id} value={sourceValue(o)}>{o.title}</option>)}
                </optgroup>
                <optgroup label="Sprawdzone rozwiązania z Polski">
                  {sources.filter((o) => o.kind === "pattern").map((o) => <option key={o.id} value={sourceValue(o)}>{o.title}</option>)}
                </optgroup>
              </NativeSelect>
            </div>
          ) : (
            <p className="text-lg">
              {chosen?.kind === "pattern" ? "Rozwiązanie" : "Inicjatywa"}: <strong>{chosen?.title}</strong>{" "}
              <Button type="button" variant="link" className="h-auto p-0 text-lg" onClick={() => setChoosingSource(true)}>
                Zmień wybór
              </Button>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="instytucja">Jaką instytucję reprezentujesz?</Label>
            <FieldError id="instytucja-blad">{errors.institution}</FieldError>
            <NativeSelect
              ref={institutionField}
              id="instytucja"
              value={institution}
              onChange={(e) => setInstitution(e.target.value as InstitutionKey | "")}
              aria-invalid={!!errors.institution}
              aria-describedby={errors.institution ? "instytucja-blad" : undefined}
            >
              <option value="">Wybierz…</option>
              {INSTITUTION_KEYS.map((t) => <option key={t} value={t}>{institutionLabel(t)}</option>)}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gmina">Gmina, do której chcesz przenieść inicjatywę</Label>
            <FieldHint id="gmina-pomoc">Weźmiemy dane o tej gminie z GUS: liczbę mieszkańców, wiek, szkoły, budżet.</FieldHint>
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

          <div className="space-y-2">
            <Label htmlFor="odbiorcy">Ile osób mogłoby skorzystać? (nieobowiązkowe)</Label>
            <FieldHint id="odbiorcy-pomoc">Wystarczy w przybliżeniu. Jeśli nie wiesz, oszacujemy to z danych o gminie.</FieldHint>
            <FieldError id="odbiorcy-blad">{errors.audience}</FieldError>
            <Input
              ref={audienceField}
              id="odbiorcy"
              inputMode="numeric"
              autoComplete="off"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              aria-invalid={!!errors.audience}
              aria-describedby={errors.audience ? "odbiorcy-pomoc odbiorcy-blad" : "odbiorcy-pomoc"}
              className="max-w-48"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kadra">Kto mógłby to prowadzić? (nieobowiązkowe)</Label>
            <FieldHint id="kadra-pomoc">Na przykład: nauczyciel informatyki i dwóch wolontariuszy z technikum.</FieldHint>
            <Input
              id="kadra"
              maxLength={300}
              autoComplete="off"
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              aria-describedby="kadra-pomoc"
              className="max-w-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budzet">Na jaki budżet się nastawiasz?</Label>
            <FieldHint id="budzet-pomoc">Wystarczy rząd wielkości. Plan nie przekroczy wybranej kwoty.</FieldHint>
            <NativeSelect id="budzet" value={budget} onChange={(e) => setBudget(e.target.value as BudgetRange)} aria-describedby="budzet-pomoc">
              {BUDGET_RANGES.map((b) => <option key={b} value={b}>{BUDGET_LABELS[b]}</option>)}
            </NativeSelect>
          </div>

          <Button type="submit" disabled={busy} className="w-full sm:w-auto">Przygotuj plan przeniesienia</Button>
        </form>
      )}
      <p aria-live="polite" className={result ? "sr-only" : "text-muted-foreground"}>{status}</p>
    </div>
  );
}
