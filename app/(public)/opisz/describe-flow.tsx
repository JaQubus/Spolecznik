"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NeedCard, RerankItem } from "@/lib/schemas";
import { AREA_LABELS } from "@/lib/taxonomy";

type Step =
  | { kind: "input" }
  | { kind: "followUp"; card: NeedCard }
  | { kind: "results"; card: NeedCard; matches: RerankItem[]; isGap: boolean };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Błąd ${res.status}`);
  return res.json();
}

export function DescribeFlow() {
  const [step, setStep] = useState<Step>({ kind: "input" });
  const [text, setText] = useState("");
  const [gmina, setGmina] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function match(card: NeedCard) {
    setStatus("Szukam rozwiązań…");
    const r = await post<{ matches: RerankItem[]; isGap: boolean }>("/api/match", { card });
    setStep({ kind: "results", card, matches: r.matches, isGap: r.isGap });
    setStatus(r.isGap ? "Nie znaleziono pasującego rozwiązania." : `Znaleziono ${r.matches.length} rozwiązań.`);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await fn(); } catch { setError("Coś poszło nie tak. Spróbuj ponownie za chwilę."); }
    finally { setBusy(false); }
  }

  const submit = () => run(async () => {
    setStatus("Analizuję opis…");
    const r = await post<{ card: NeedCard; needsFollowUp: boolean }>("/api/intake", { text, gmina: gmina || undefined });
    if (r.needsFollowUp) {
      setStep({ kind: "followUp", card: r.card });
      setStatus("Mamy jedno pytanie.");
    } else await match(r.card);
  });

  const submitAnswer = (card: NeedCard) => run(async () => {
    const r = await post<{ card: NeedCard }>("/api/intake", { text: answer, previousCard: card });
    await match(r.card);
  });

  return (
    <div className="space-y-6">
      <p aria-live="polite" className="sr-only">{status}</p>
      {error && <p role="alert" className="font-medium text-destructive">{error}</p>}

      {step.kind === "input" && (
        <form className="max-w-2xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="space-y-2">
            <Label htmlFor="opis" className="text-lg">Na czym polega problem?</Label>
            {/* TODO: przycisk mikrofonu (Web Speech API, pl-PL) */}
            <Textarea id="opis" required minLength={3} rows={6} value={text} onChange={(e) => setText(e.target.value)} className="text-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gmina">Gmina (nieobowiązkowo)</Label>
            <Input id="gmina" value={gmina} onChange={(e) => setGmina(e.target.value)} />
          </div>
          <Button type="submit" size="lg" disabled={busy} className="h-12 px-8 text-lg">
            {busy ? "Szukam…" : "Znajdź rozwiązania"}
          </Button>
        </form>
      )}

      {step.kind === "followUp" && (
        <form className="max-w-2xl space-y-4" onSubmit={(e) => { e.preventDefault(); submitAnswer(step.card); }}>
          <Label htmlFor="odp" className="text-lg">{step.card.followUp}</Label>
          <Textarea id="odp" required rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} className="text-lg" />
          <Button type="submit" size="lg" disabled={busy}>{busy ? "Szukam…" : "Dalej"}</Button>
        </form>
      )}

      {step.kind === "results" && (
        <div className="space-y-4">
          <p className="text-lg"><strong>Zrozumieliśmy tak:</strong> {step.card.summary}</p>
          <div className="flex flex-wrap gap-2">
            {step.card.areas.map((a) => <Badge key={a} variant="secondary">{AREA_LABELS[a]}</Badge>)}
          </div>
          {step.isGap ? (
            <Card>
              <CardHeader><CardTitle>Nie znaleźliśmy jeszcze rozwiązania</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p>To ważna informacja — zapisaliśmy ją na mapie potrzeb. Masz pomysł, jak to rozwiązać?</p>
                <Button asChild><a href="/pomysl">Zgłoś pomysł</a></Button>
              </CardContent>
            </Card>
          ) : (
            <ol className="space-y-4">
              {step.matches.map((m) => (
                <li key={m.id}>
                  <Card>
                    <CardHeader><CardTitle>Dopasowanie: {m.fit}/100</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <p><strong>Dlaczego pasuje:</strong> {m.why}</p>
                      <p><strong>Co dostosować u Ciebie:</strong> {m.adapt}</p>
                      {/* TODO: tytuł innowacji, przyciski Wdrożenie / Przetestuj / Ekspert / 👍👎 */}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          )}
          <Button variant="outline" onClick={() => { setStep({ kind: "input" }); setAnswer(""); }}>Opisz inny problem</Button>
        </div>
      )}
    </div>
  );
}
