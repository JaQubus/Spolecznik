"use client";

import { CircleAlert, CircleCheck, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { formatDate } from "@/lib/pl";
import type { ApplicationDraft as Draft } from "@/lib/schemas";

export type ActiveCall = { id: string; title: string; closesAt: string | null };

/** Generator wniosków (#17): widoczny tylko przy aktywnym naborze, eksport przez druk do PDF. */
export function ApplicationDraft({ ideaId, calls }: { ideaId: string; calls: ActiveCall[] }) {
  const [callId, setCallId] = useState(calls[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (draft) heading.current?.focus(); }, [draft]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, callId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się przygotować szkicu");
      setDraft(json.draft as Draft);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie za chwilę.`);
    } finally {
      setBusy(false);
    }
  }

  const call = calls.find((c) => c.id === callId);

  if (draft) {
    const missing = draft.checklist.filter((c) => !c.met).length;
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">Szkic wniosku{call ? `: ${call.title}` : ""}</h2>
          <p className="text-muted-foreground">To szkic do poprawienia. Miejsca oznaczone „DO UZUPEŁNIENIA” wymagają Twoich danych.</p>
        </div>
        <div className="max-w-[68ch] space-y-6">
          {draft.sections.map((s) => (
            <section key={s.field} className="space-y-1">
              <h3 className="text-lg font-bold">{s.label}</h3>
              <p className="whitespace-pre-line">{s.content}</p>
            </section>
          ))}
        </div>
        {draft.checklist.length > 0 && (
          <section aria-labelledby="kryteria" className="max-w-[68ch] space-y-3">
            <h3 id="kryteria" className="text-xl font-bold">
              Kryteria naboru{missing > 0 ? ` — do poprawy: ${missing}` : " — wszystkie spełnione"}
            </h3>
            <ul className="divide-y border-y">
              {draft.checklist.map((c) => (
                <li key={c.criterion} className="flex items-start gap-3 py-3">
                  {c.met
                    ? <CircleCheck aria-hidden className="mt-1 size-6 shrink-0 text-primary" />
                    : <CircleAlert aria-hidden className="mt-1 size-6 shrink-0 text-destructive" />}
                  <div>
                    <p className="font-bold">{c.met ? "Spełnione" : "Do poprawy"}: {c.criterion}</p>
                    {c.note && <p className="text-muted-foreground">{c.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Button type="button" variant="outline" onClick={() => window.print()} className="print:hidden">
          <Printer aria-hidden /> Wydrukuj albo zapisz jako PDF
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p>Trwa nabór, do którego możesz zgłosić ten pomysł. Przygotujemy szkic wniosku z Twojej fiszki.</p>
      {calls.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="font-bold">Wybierz nabór</legend>
          <RadioGroup value={callId} onValueChange={setCallId}>
            {calls.map((c) => (
              <RadioGroupOption
                key={c.id}
                id={`nabor-${c.id}`}
                value={c.id}
                label={c.title}
                hint={c.closesAt ? `Wnioski do ${formatDate(c.closesAt)}` : undefined}
              />
            ))}
          </RadioGroup>
        </fieldset>
      )}
      {calls.length === 1 && call?.closesAt && <p className="text-muted-foreground">{call.title} · wnioski do {formatDate(call.closesAt)}</p>}
      <div aria-live="polite">
        {busy && <p className="text-muted-foreground">Piszę szkic wniosku. To może potrwać kilkanaście sekund.</p>}
        {error && <Alert tone="error" title="Coś poszło nie tak"><p>{error}</p></Alert>}
      </div>
      <Button type="button" variant="outline" disabled={busy || !callId} onClick={generate}>Przygotuj szkic wniosku</Button>
    </div>
  );
}
