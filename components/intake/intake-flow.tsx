"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { EMPTY_GMINA, GminaField, type GminaValue } from "@/components/gmina-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GminaOption } from "@/lib/gminy";
import type { ChallengeCard, ChallengeResponse, InitiativeCard, InitiativeResponse, IntakeMode } from "@/lib/schemas";
import { ChallengeResults } from "./challenge-results";
import { InitiativeResults } from "./initiative-results";
import { VoiceInput } from "./voice-input";

type Card = InitiativeCard | ChallengeCard;
type Step =
  | { kind: "input" }
  // Opis przyszedł z wyszukiwarki na stronie startowej: zamiast formularza od razu sam status.
  | { kind: "reading" }
  | { kind: "followUp"; card: Card; questions: string[] }
  | { kind: "initiative"; card: InitiativeCard; result: InitiativeResponse }
  | { kind: "challenge"; card: ChallengeCard; result: ChallengeResponse };

type IntakeResponse = { card: Card; followUps: string[]; piiFound: boolean };

const COPY: Record<IntakeMode, { label: string; hint: string; example: string; submit: string; busy: string; working: string; voice: string }> = {
  own: {
    label: "Opisz inicjatywę",
    hint: "Co robicie, dla kogo, od kiedy i co już z tego wyszło. Wystarczy kilka zdań.",
    example: "Opisz inicjatywę w kilku zdaniach, np. „uczniowie technikum uczą seniorów obsługi e-usług w bibliotece”.",
    submit: "Wyślij zgłoszenie",
    busy: "Wysyłam…",
    working: "Zapisuję zgłoszenie i szukam podobnych inicjatyw. To może potrwać kilkanaście sekund.",
    voice: "Opowiedz o inicjatywie",
  },
  nomination: {
    label: "Jaką inicjatywę chcesz wskazać?",
    hint: "Gdzie działa, kto ją prowadzi (bez nazwisk), co w niej ciekawego. Nie musisz znać szczegółów.",
    example: "Napisz kilka zdań o inicjatywie, np. „w gminie Dynów szkoła i dom kultury prowadzą wspólną pracownię robotyki”.",
    submit: "Wyślij wskazanie",
    busy: "Wysyłam…",
    working: "Zapisuję wskazanie i sprawdzam, czy ktoś już zgłosił tę inicjatywę. To może potrwać kilkanaście sekund.",
    voice: "Opowiedz głosem",
  },
  challenge: {
    label: "Jaki problem chcecie rozwiązać?",
    hint: "Kogo dotyczy, gdzie, co już próbowaliście. Wystarczy kilka zdań.",
    example: "Opisz problem w kilku słowach, np. „uczniowie z dalekich wsi nie zostają na zajęciach, bo ostatni autobus jest o 14”.",
    submit: "Znajdź rozwiązania",
    busy: "Szukam…",
    working: "Szukam inicjatyw i rozwiązań. To może potrwać kilkanaście sekund.",
    voice: "Opowiedz problem",
  },
};

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? `Błąd ${res.status}`);
  return json as T;
}

const appendText = (prev: string, chunk: string) => (prev ? `${prev.trimEnd()} ${chunk}` : chunk);

/**
 * Wspólny przepływ: opis (tekst albo głos) → karta z intake → najwyżej jedna runda pytań → wynik.
 * mode = own (Zgłoś), nomination (Wskaż) albo challenge (Szukam rozwiązania).
 */
export function IntakeFlow({
  mode,
  path,
  gminy,
  initialText = "",
  initialGmina = EMPTY_GMINA,
}: { mode: IntakeMode; path: string; gminy: GminaOption[]; initialText?: string; initialGmina?: GminaValue }) {
  const copy = COPY[mode];
  const fromSearch = initialText.trim().length >= 3;
  const [step, setStep] = useState<Step>(fromSearch ? { kind: "reading" } : { kind: "input" });
  const [text, setText] = useState(initialText);
  const [gmina, setGmina] = useState(initialGmina);
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [status, setStatus] = useState(fromSearch ? "Czytam opis…" : "");
  const [piiFound, setPiiFound] = useState(false);
  const errorBox = useRef<HTMLDivElement>(null);
  const textField = useRef<HTMLTextAreaElement>(null);
  const answerField = useRef<HTMLTextAreaElement>(null);

  // Błąd po wysłaniu: fokus na podsumowanie, żeby czytnik od razu je przeczytał (Alert.md).
  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie za chwilę.`);
      setStatus("");
      // Bez formularza nie dałoby się poprawić opisu i spróbować ponownie.
      setStep((s) => (s.kind === "reading" ? { kind: "input" } : s));
    } finally {
      setBusy(false);
    }
  }

  async function finish(card: Card, rawText: string) {
    setStatus(copy.working);
    const where = { gmina: gmina.text || undefined, teryt: gmina.teryt ?? undefined };
    if (mode === "challenge") {
      const result = await post<ChallengeResponse>("/api/challenges", { card, text: rawText, ...where });
      setStep({ kind: "challenge", card: card as ChallengeCard, result });
    } else {
      const result = await post<InitiativeResponse>("/api/initiatives", { kind: mode, card, text: rawText, ...where });
      setStep({ kind: "initiative", card: card as InitiativeCard, result });
    }
    setStatus("");
  }

  // Walidacja przy wysłaniu, nie blokowany przycisk (Button.md, TextField.md).
  function submit() {
    if (text.trim().length < 3) {
      setFieldError(copy.example);
      textField.current?.focus();
      return;
    }
    setFieldError(null);
    run(async () => {
      setStatus("Czytam opis…");
      const r = await post<IntakeResponse>("/api/intake", { mode, text, gmina: gmina.text || undefined });
      setPiiFound(r.piiFound);
      if (r.followUps.length > 0) {
        setAnswers(r.followUps.map(() => ""));
        setStep({ kind: "followUp", card: r.card, questions: r.followUps });
        setStatus(r.followUps.length === 1 ? "Mamy jedno pytanie, zanim zapiszemy opis." : "Mamy dwa krótkie pytania, zanim zapiszemy opis.");
      } else {
        await finish(r.card, text);
      }
    });
  }

  function submitAnswers(card: Card, questions: string[]) {
    if (answers.every((a) => !a.trim())) {
      setFieldError("Odpowiedz na pytanie albo wybierz „Pomiń pytania”.");
      answerField.current?.focus();
      return;
    }
    setFieldError(null);
    const qa = questions.map((q, i) => (answers[i]?.trim() ? `${q}\n${answers[i].trim()}` : null)).filter(Boolean).join("\n\n");
    run(async () => {
      setStatus("Czytam odpowiedź…");
      const r = await post<IntakeResponse>("/api/intake", { mode, text: qa, previousCard: card });
      await finish(r.card, `${text}\n\nDoprecyzowanie:\n${qa}`);
    });
  }

  // Przyszło z wyszukiwarki na stronie startowej: od razu szukamy i czyścimy adres,
  // żeby odświeżenie strony nie wysłało zgłoszenia drugi raz.
  const autoStart = useEffectEvent(() => {
    window.history.replaceState(null, "", path);
    submit();
  });
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !initialText) return;
    started.current = true;
    autoStart();
  }, [initialText]);

  function reset() {
    setStep({ kind: "input" });
    setText("");
    setAnswers([]);
    setPiiFound(false);
  }

  return (
    <div className="space-y-6">
      <p aria-live="polite" className={busy || step.kind === "reading" ? "text-lg font-bold" : "sr-only"}>{status}</p>
      {error && (
        <Alert ref={errorBox} tabIndex={-1} tone="error" title="Nie udało się">
          <p>{error}</p>
        </Alert>
      )}
      {piiFound && step.kind !== "input" && (
        <Alert title="Ukryliśmy dane osobowe">
          <p>W opisie były dane osobowe (np. telefon lub adres). Ukryliśmy je, zanim tekst trafił do analizy.</p>
        </Alert>
      )}

      {step.kind === "input" && (
        <form className="max-w-2xl space-y-6" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {/* Obok pola tekstowego mikrofon jest drugorzędny: zielony zostaje tylko przycisk wysyłania. */}
          <VoiceInput label={copy.voice} onText={(chunk) => setText((t) => appendText(t, chunk))} />
          <div className="space-y-2">
            <Label htmlFor="opis">{copy.label}</Label>
            <FieldHint id="opis-pomoc">{copy.hint} Nie podawaj nazwisk, numerów telefonu ani adresów.</FieldHint>
            <FieldError id="opis-blad">{fieldError}</FieldError>
            <Textarea
              ref={textField}
              id="opis"
              aria-describedby={fieldError ? "opis-pomoc opis-blad" : "opis-pomoc"}
              aria-invalid={fieldError ? true : undefined}
              maxLength={5000}
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gmina">Gmina</Label>
            <FieldHint id="gmina-pomoc">{mode === "challenge" ? "Nieobowiązkowo. Pomoże dopasować rozwiązania do Twojej gminy." : "Gdzie działa inicjatywa. Nieobowiązkowo."}</FieldHint>
            <div className="max-w-sm">
              <GminaField id="gmina" aria-describedby="gmina-pomoc" options={gminy} value={gmina} onValueChange={setGmina} />
            </div>
          </div>
          <Button type="submit" aria-disabled={busy || undefined} className="w-full sm:w-auto">
            {busy ? copy.busy : copy.submit}
          </Button>
        </form>
      )}

      {step.kind === "followUp" && (
        <form className="max-w-2xl space-y-6" noValidate onSubmit={(e) => { e.preventDefault(); submitAnswers(step.card, step.questions); }}>
          <FieldError id="odp-blad">{fieldError}</FieldError>
          {step.questions.map((q, i) => (
            <div key={q} className="space-y-2">
              {/* Zwykły <label> zamiast Label z radix: tamten blokuje zaznaczanie tekstu, a pytanie warto móc skopiować. */}
              <label htmlFor={`odp-${i}`} className="block text-lg font-bold">{q}</label>
              <Textarea
                ref={i === 0 ? answerField : undefined}
                id={`odp-${i}`}
                rows={3}
                aria-describedby={fieldError && i === 0 ? "odp-blad" : undefined}
                aria-invalid={fieldError && i === 0 ? true : undefined}
                value={answers[i] ?? ""}
                onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
              />
            </div>
          ))}
          <VoiceInput label="Odpowiedz głosem" onText={(chunk) => setAnswers((a) => a.map((v, j) => (j === 0 ? appendText(v, chunk) : v)))} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" aria-disabled={busy || undefined} className="w-full sm:w-auto">{busy ? copy.busy : "Dalej"}</Button>
            <Button type="button" variant="ghost" aria-disabled={busy || undefined} onClick={() => run(() => finish(step.card, text))}>
              Pomiń pytania
            </Button>
          </div>
        </form>
      )}

      {step.kind === "initiative" && mode !== "challenge" && (
        <InitiativeResults kind={mode} card={step.card} result={step.result} onReset={reset} />
      )}
      {step.kind === "challenge" && <ChallengeResults card={step.card} result={step.result} onReset={reset} />}
    </div>
  );
}
