"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { EMPTY_GMINA, GminaField, type GminaValue } from "@/components/gmina-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GminaOption } from "@/lib/gminy";
import type { MatchResponse, NeedCard } from "@/lib/schemas";
import { MatchResults } from "./match-results";
import { VoiceInput } from "./voice-input";

type Step =
  | { kind: "input" }
  | { kind: "followUp"; card: NeedCard }
  | { kind: "results"; card: NeedCard; result: MatchResponse };

type IntakeResponse = { card: NeedCard; needsFollowUp: boolean; piiFound: boolean };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? `Błąd ${res.status}`);
  return json as T;
}

const appendText = (prev: string, chunk: string) => (prev ? `${prev.trimEnd()} ${chunk}` : chunk);

export function DescribeFlow({ gminy, initialText = "", initialGmina = EMPTY_GMINA }: { gminy: GminaOption[]; initialText?: string; initialGmina?: GminaValue }) {
  const [step, setStep] = useState<Step>({ kind: "input" });
  const [text, setText] = useState(initialText);
  const [gmina, setGmina] = useState(initialGmina);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
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
    } finally {
      setBusy(false);
    }
  }

  async function match(card: NeedCard, rawText: string) {
    setStatus("Szukam rozwiązań. To może potrwać kilkanaście sekund.");
    const result = await post<MatchResponse>("/api/match", {
      card, text: rawText, gmina: gmina.text || undefined, teryt: gmina.teryt ?? undefined,
    });
    setStep({ kind: "results", card, result });
    setStatus("");
  }

  // Walidacja przy wysłaniu, nie blokowany przycisk (Button.md, TextField.md).
  function submit() {
    if (text.trim().length < 3) {
      setFieldError("Opisz problem w kilku słowach, np. „starsi mieszkańcy nie mają jak dojechać do lekarza”.");
      textField.current?.focus();
      return;
    }
    setFieldError(null);
    run(async () => {
      setStatus("Czytam opis…");
      const r = await post<IntakeResponse>("/api/intake", { text, gmina: gmina.text || undefined });
      setPiiFound(r.piiFound);
      if (r.needsFollowUp) {
        setStep({ kind: "followUp", card: r.card });
        setStatus("Mamy jedno pytanie, żeby lepiej dopasować rozwiązania.");
      } else {
        await match(r.card, text);
      }
    });
  }

  function submitAnswer(card: NeedCard) {
    if (!answer.trim()) {
      setFieldError("Napisz odpowiedź albo wybierz „Pomiń pytanie”.");
      answerField.current?.focus();
      return;
    }
    setFieldError(null);
    run(async () => {
      setStatus("Czytam odpowiedź…");
      const r = await post<IntakeResponse>("/api/intake", { text: answer, previousCard: card });
      await match(r.card, `${text}\n\nDoprecyzowanie: ${answer}`);
    });
  }

  // Przyszło z wyszukiwarki na stronie startowej: od razu szukamy i czyścimy adres,
  // żeby odświeżenie strony nie wysłało zgłoszenia drugi raz.
  const autoStart = useEffectEvent(() => {
    window.history.replaceState(null, "", "/opisz");
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
    setAnswer("");
    setPiiFound(false);
  }

  return (
    <div className="space-y-6">
      <p aria-live="polite" className={busy ? "text-lg font-bold" : "sr-only"}>{status}</p>
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
          {/* Obok pola tekstowego mikrofon jest drugorzędny: zielony zostaje tylko „Znajdź rozwiązania”. */}
          <VoiceInput onText={(chunk) => setText((t) => appendText(t, chunk))} />
          <div className="space-y-2">
            <Label htmlFor="opis">Na czym polega problem?</Label>
            <FieldHint id="opis-pomoc">Kogo dotyczy, gdzie, co już próbowaliście. Wystarczy kilka zdań.</FieldHint>
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
            <FieldHint id="gmina-pomoc">Nieobowiązkowo.</FieldHint>
            <div className="max-w-sm">
              <GminaField id="gmina" aria-describedby="gmina-pomoc" options={gminy} value={gmina} onValueChange={setGmina} />
            </div>
          </div>
          <Button type="submit" aria-disabled={busy || undefined} className="w-full sm:w-auto">
            {busy ? "Szukam…" : "Znajdź rozwiązania"}
          </Button>
        </form>
      )}

      {step.kind === "followUp" && (
        <form className="max-w-2xl space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); submitAnswer(step.card); }}>
          <Label htmlFor="odp">{step.card.followUp}</Label>
          <VoiceInput label="Odpowiedz głosem" onText={(chunk) => setAnswer((a) => appendText(a, chunk))} />
          <FieldError id="odp-blad">{fieldError}</FieldError>
          <Textarea
            ref={answerField}
            id="odp"
            rows={3}
            aria-describedby={fieldError ? "odp-blad" : undefined}
            aria-invalid={fieldError ? true : undefined}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" aria-disabled={busy || undefined} className="w-full sm:w-auto">{busy ? "Szukam…" : "Dalej"}</Button>
            <Button type="button" variant="ghost" aria-disabled={busy || undefined} onClick={() => run(() => match(step.card, text))}>
              Pomiń pytanie
            </Button>
          </div>
        </form>
      )}

      {step.kind === "results" && <MatchResults card={step.card} result={step.result} onReset={reset} />}
    </div>
  );
}
