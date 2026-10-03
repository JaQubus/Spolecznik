"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AskResponse } from "@/lib/schemas";

const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/** Zapytaj Bibliotekę: odpowiedź tylko z raportów ROPS, z odnośnikiem do strony PDF. */
export function AskLibrary() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 3) {
      setFieldError("Wpisz pytanie, np. „ile osób 65+ mieszka w gminach wiejskich?”.");
      field.current?.focus();
      return;
    }
    setFieldError(null);
    setError(null);
    setAnswer(null);
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się odpowiedzieć");
      setAnswer(json as AskResponse);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie za chwilę.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <Alert ref={errorBox} tabIndex={-1} tone="error" title="Coś poszło nie tak"><p>{error}</p></Alert>}
        <div className="space-y-2">
          <Label htmlFor="pytanie">Twoje pytanie</Label>
          <FieldHint id="pytanie-pomoc">Odpowiadamy tylko na podstawie raportów ROPS i podajemy stronę, z której to wiemy.</FieldHint>
          <FieldError id="pytanie-blad">{fieldError}</FieldError>
          <Textarea
            ref={field}
            id="pytanie"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-invalid={!!fieldError}
            aria-describedby={fieldError ? "pytanie-pomoc pytanie-blad" : "pytanie-pomoc"}
          />
        </div>
        <Button type="submit" variant="outline" disabled={busy}>{busy ? "Szukam w raportach…" : "Zapytaj"}</Button>
      </form>

      <div aria-live="polite">
        {answer && (
          <div className="space-y-3">
            <p className="max-w-[68ch] text-lg">{answer.answer}</p>
            {answer.sources.length > 0 && (
              <>
                <p className="font-bold">Źródła</p>
                <ul className="list-disc space-y-1 pl-6">
                  {answer.sources.map((s, i) => {
                    const label = `${s.docTitle}${s.year ? ` (${s.year})` : ""}${s.page ? `, strona ${s.page}` : ""}`;
                    return (
                      <li key={i}>
                        {s.url ? (
                          <a href={s.page ? `${s.url}#page=${s.page}` : s.url} target="_blank" rel="noreferrer" className={linkClass}>
                            {label}<span className="sr-only"> (otwiera się w nowej karcie)</span>
                          </a>
                        ) : label}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
