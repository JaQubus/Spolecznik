"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function DescribeFlow() {
  const [step, setStep] = useState<Step>({ kind: "input" });
  const [text, setText] = useState("");
  const [gmina, setGmina] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [piiFound, setPiiFound] = useState(false);

  async function run(fn: () => Promise<void>) {
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
    const result = await post<MatchResponse>("/api/match", { card, text: rawText, gmina: gmina || undefined });
    setStep({ kind: "results", card, result });
    setStatus("");
  }

  const submit = () => run(async () => {
    setStatus("Czytam opis…");
    const r = await post<IntakeResponse>("/api/intake", { text, gmina: gmina || undefined });
    setPiiFound(r.piiFound);
    if (r.needsFollowUp) {
      setStep({ kind: "followUp", card: r.card });
      setStatus("Mamy jedno pytanie, żeby lepiej dopasować rozwiązania.");
    } else {
      await match(r.card, text);
    }
  });

  const submitAnswer = (card: NeedCard) => run(async () => {
    setStatus("Czytam odpowiedź…");
    const r = await post<IntakeResponse>("/api/intake", { text: answer, previousCard: card });
    await match(r.card, `${text}\n\nDoprecyzowanie: ${answer}`);
  });

  function reset() {
    setStep({ kind: "input" });
    setText("");
    setAnswer("");
    setPiiFound(false);
  }

  return (
    <div className="space-y-6">
      <p aria-live="polite" className={busy ? "text-lg font-medium" : "sr-only"}>{status}</p>
      {error && <p role="alert" className="text-lg font-medium text-destructive">{error}</p>}
      {piiFound && step.kind !== "input" && (
        <p className="rounded-md border border-amber-500 bg-amber-50 p-3 text-amber-950">
          W opisie były dane osobowe (np. telefon lub adres). Ukryliśmy je, zanim tekst trafił do analizy.
        </p>
      )}

      {step.kind === "input" && (
        <form className="max-w-2xl space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <VoiceInput onText={(chunk) => setText((t) => appendText(t, chunk))} />
          <div className="space-y-2">
            <Label htmlFor="opis" className="text-lg">Na czym polega problem?</Label>
            <p id="opis-pomoc" className="text-muted-foreground">
              Kogo dotyczy, gdzie, co już próbowaliście. Wystarczy kilka zdań.
            </p>
            <Textarea
              id="opis"
              aria-describedby="opis-pomoc"
              required
              minLength={3}
              maxLength={5000}
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gmina" className="text-lg">Gmina (nieobowiązkowo)</Label>
            <Input id="gmina" autoComplete="address-level2" value={gmina} onChange={(e) => setGmina(e.target.value)} className="max-w-sm text-lg" />
          </div>
          <Button type="submit" size="lg" disabled={busy || text.trim().length < 3} className="h-12 px-8 text-lg">
            {busy ? "Szukam…" : "Znajdź rozwiązania"}
          </Button>
        </form>
      )}

      {step.kind === "followUp" && (
        <form className="max-w-2xl space-y-4" onSubmit={(e) => { e.preventDefault(); submitAnswer(step.card); }}>
          <Label htmlFor="odp" className="text-lg">{step.card.followUp}</Label>
          <VoiceInput label="Odpowiedz głosem" onText={(chunk) => setAnswer((a) => appendText(a, chunk))} />
          <Textarea id="odp" required rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} className="text-lg" />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" disabled={busy || !answer.trim()}>{busy ? "Szukam…" : "Dalej"}</Button>
            <Button type="button" size="lg" variant="ghost" disabled={busy} onClick={() => run(() => match(step.card, text))}>
              Pomiń pytanie
            </Button>
          </div>
        </form>
      )}

      {step.kind === "results" && <MatchResults card={step.card} result={step.result} onReset={reset} />}
    </div>
  );
}
