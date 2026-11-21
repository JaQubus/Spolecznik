"use client";

import { ClipboardDocumentIcon, DocumentTextIcon, PrinterIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GminaField, type GminaValue } from "@/components/gmina-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PlanDocument } from "@/components/wdrozenie/plan-document";
import { flags } from "@/lib/flags";
import type { GminaOption } from "@/lib/gminy";
import { planToText } from "@/lib/implementation-plan";
import {
  BUDGET_LABELS, BUDGET_RANGES, INSTITUTION_LABELS, INSTITUTION_TYPES,
  type BudgetRange, type InstitutionType, type PlanDocument as Doc,
} from "@/lib/schemas";

type Errors = Partial<Record<"innovation" | "institution" | "gmina" | "audience", string>>;

/** Groq potrafi myśleć długo nad całym dokumentem; dłużej nie trzymamy użytkownika przy „Przygotowuję…”. */
const TIMEOUT_MS = 90_000;

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
  // Z karty innowacji rozwiązanie jest już wybrane — formularz ma wtedy 5 pól, a listę pokazujemy na żądanie.
  const [choosingInnovation, setChoosingInnovation] = useState(!initialInnovation);
  const [institution, setInstitution] = useState<InstitutionType | "">("");
  const [gmina, setGmina] = useState<GminaValue>(initialGmina);
  const [audience, setAudience] = useState("");
  const [staff, setStaff] = useState("");
  const [budget, setBudget] = useState<BudgetRange>("nie_wiem");

  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Doc | null>(null);
  const [copied, setCopied] = useState("");
  const innovationField = useRef<HTMLSelectElement>(null);
  const institutionField = useRef<HTMLSelectElement>(null);
  const gminaField = useRef<HTMLInputElement>(null);
  const audienceField = useRef<HTMLInputElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  useEffect(() => { if (result) heading.current?.focus(); }, [result]);

  const innovationTitle = innovations.find((i) => i.id === innovationId)?.title;
  const audienceDigits = audience.replace(/\s/g, "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!innovationId) next.innovation = "Wybierz rozwiązanie z listy.";
    if (!institution) next.institution = "Wybierz, jaką instytucję reprezentujesz.";
    if (gmina.text.trim().length < 2) next.gmina = "Wpisz nazwę gminy, np. „Bobowa”.";
    if (audienceDigits && !/^[1-9]\d{0,6}$/.test(audienceDigits)) next.audience = "Wpisz liczbę osób cyframi, np. 40, albo zostaw puste.";
    setErrors(next);
    if (next.innovation) { setChoosingInnovation(true); return innovationField.current?.focus(); }
    if (next.institution) return institutionField.current?.focus();
    if (next.gmina) return gminaField.current?.focus();
    if (next.audience) return audienceField.current?.focus();

    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/middleman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          innovationId,
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
      setCopied("Skopiowano tekst planu. Możesz go wkleić do edytora tekstu albo formularza wniosku.");
    } catch {
      setCopied("Nie udało się skopiować. Zaznacz tekst planu i skopiuj go skrótem Ctrl+C.");
    }
  }

  const status = busy
    ? "Przygotowuję plan wdrożenia. To może potrwać do minuty."
    : result ? `Plan wdrożenia gotowy: ${result.innovation.title} w gminie ${result.gmina.nazwa}.` : "";

  return (
    <div className="space-y-6">
      {result ? (
        <div className="space-y-8">
          <PlanDocument doc={result} headingRef={heading} />
          <div className="space-y-3 print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              {flags.wniosekUslugaWrazliwa && result.id && (
                <Button asChild><Link href={`/wniosek-o-grant?plan=${result.id}`}><DocumentTextIcon aria-hidden className="size-5" /> Przejdź do wniosku o grant</Link></Button>
              )}
              <Button type="button" variant="outline" onClick={() => window.print()}><PrinterIcon aria-hidden className="size-5" /> Drukuj / zapisz PDF</Button>
              <Button type="button" variant="outline" onClick={() => copy(result)}><ClipboardDocumentIcon aria-hidden className="size-5" /> Kopiuj tekst</Button>
              <Button asChild variant="link"><Link href={`/przetestuj?innowacja=${result.innovation.id}`}>Chcę przetestować</Link></Button>
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
              <p>Twoje odpowiedzi zostały w formularzu. Spróbuj ponownie za minutę, klikając „Przygotuj plan wdrożenia”.</p>
            </Alert>
          )}

          {choosingInnovation ? (
            <div className="space-y-2">
              <Label htmlFor="innowacja">Rozwiązanie</Label>
              <FieldError id="innowacja-blad">{errors.innovation}</FieldError>
              <NativeSelect
                ref={innovationField}
                id="innowacja"
                value={innovationId}
                onChange={(e) => setInnovationId(e.target.value)}
                aria-invalid={!!errors.innovation}
                aria-describedby={errors.innovation ? "innowacja-blad" : undefined}
              >
                <option value="">Wybierz z Biblioteki…</option>
                {innovations.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </NativeSelect>
            </div>
          ) : (
            <p className="text-lg">
              Rozwiązanie: <strong>{innovationTitle ?? "wybrane w Bibliotece"}</strong>{" "}
              <Button type="button" variant="link" className="h-auto p-0 text-lg" onClick={() => setChoosingInnovation(true)}>
                Zmień rozwiązanie
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
              onChange={(e) => setInstitution(e.target.value as InstitutionType | "")}
              aria-invalid={!!errors.institution}
              aria-describedby={errors.institution ? "instytucja-blad" : undefined}
            >
              <option value="">Wybierz…</option>
              {INSTITUTION_TYPES.map((t) => <option key={t} value={t}>{INSTITUTION_LABELS[t]}</option>)}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gmina">Gmina, w której chcesz wdrożyć usługę</Label>
            <FieldHint id="gmina-pomoc">Weźmiemy dane o tej gminie z GUS: liczbę mieszkańców, seniorów, osób korzystających z pomocy społecznej.</FieldHint>
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
            <Label htmlFor="kadra">Kto mógłby prowadzić usługę? (nieobowiązkowe)</Label>
            <FieldHint id="kadra-pomoc">Na przykład: 2 pracowników socjalnych, psycholog na pół etatu.</FieldHint>
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
            <FieldHint id="budzet-pomoc">Grant w naborze „Usługa Wrażliwa” to najwyżej 600 tys. zł, bez wkładu własnego.</FieldHint>
            <NativeSelect id="budzet" value={budget} onChange={(e) => setBudget(e.target.value as BudgetRange)} aria-describedby="budzet-pomoc">
              {BUDGET_RANGES.map((b) => <option key={b} value={b}>{BUDGET_LABELS[b]}</option>)}
            </NativeSelect>
          </div>

          <Button type="submit" disabled={busy} className="w-full sm:w-auto">Przygotuj plan wdrożenia</Button>
        </form>
      )}
      <p aria-live="polite" className={result ? "sr-only" : "text-muted-foreground"}>{status}</p>
    </div>
  );
}
