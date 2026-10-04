"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EmailOptIn } from "@/components/rozmowa/email-opt-in";
import { PrivateLink } from "@/components/rozmowa/private-link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { Fiszka, IdeaResponse } from "@/lib/schemas";
import { ApplicationDraft, type ActiveCall } from "./application-draft";
import { AssistantChat } from "./assistant-chat";

export type CanvasField = { key: string; label: string; hint?: string };

const STAGES = ["Pomysł", "Plan działania", "Prototyp albo pilotaż", "Już działa"];
const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

export function IdeaWorkshop({
  initial,
  needCode,
  canvasFields,
  calls,
}: {
  initial: Partial<Fiszka>;
  needCode?: string;
  canvasFields: CanvasField[];
  calls: ActiveCall[];
}) {
  const [fiszka, setFiszka] = useState<Fiszka>({
    krotki_opis: initial.krotki_opis ?? "",
    problem: initial.problem ?? "",
    istota: initial.istota ?? "",
    dla_kogo: initial.dla_kogo ?? "",
    etap: initial.etap ?? STAGES[0],
  });
  const [canvas, setCanvas] = useState<Record<string, string>>({});
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IdeaResponse | null>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const applicationHref = `/wniosek?${new URLSearchParams({
    tytul: fiszka.krotki_opis,
    problem: fiszka.problem,
    opis: fiszka.istota,
    odbiorcy: fiszka.dla_kogo,
  }).toString()}`;

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  useEffect(() => { if (result) doneHeading.current?.focus(); }, [result]);

  const set = (key: keyof Fiszka) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFiszka((f) => ({ ...f, [key]: e.target.value }));

  async function submit() {
    if (fiszka.krotki_opis.trim().length < 3) {
      setFieldError("Nazwij pomysł w kilku słowach, np. „Wspólne dojazdy seniorów do przychodni”.");
      titleField.current?.focus();
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      const filled = Object.fromEntries(Object.entries(canvas).filter(([, v]) => v.trim()));
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiszka, canvas: filled, needCode }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się zapisać pomysłu");
      setResult(json as IdeaResponse);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie za chwilę.`);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-12">
        <div className="space-y-4">
          <h2 ref={doneHeading} tabIndex={-1} className="text-2xl font-bold outline-none">Dziękujemy, pomysł jest zgłoszony</h2>
          <div className="max-w-[44rem] space-y-4 rounded-[16px] bg-secondary px-5 py-4">
            <div className="space-y-1">
              <p className="text-lg">
                Twój kod zgłoszenia: <strong className="font-mono text-2xl tracking-wider whitespace-nowrap">{result.statusCode}</strong>
              </p>
              <p>
                Zapisz go. Po tym kodzie sprawdzisz, co dzieje się z pomysłem — bez zakładania konta.{" "}
                <Link href={`/status/${result.statusCode}`} className={linkClass}>Sprawdź status</Link>
              </p>
              <p>
                Ta przeglądarka zapamięta pomysł, więc tutaj kod nie będzie potrzebny:{" "}
                <Link href="/status" className={linkClass}>Twoje zgłoszenia na tym urządzeniu</Link>.
              </p>
            </div>
            <PrivateLink code={result.statusCode} accessKey={result.accessKey} kind="pomysl" />
            <EmailOptIn code={result.statusCode} accessKey={result.accessKey} />
          </div>
          <p className="max-w-2xl">Pracownik ROPS przeczyta pomysł i może zaprosić eksperta do rozmowy z Tobą.</p>
        </div>
        {calls.length > 0 && <ApplicationDraft ideaId={result.ideaId} calls={calls} />}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section aria-labelledby="fiszka" className="max-w-2xl space-y-6">
        <h2 id="fiszka" className="text-2xl font-bold">Fiszka pomysłu</h2>
        {error && <Alert ref={errorBox} tabIndex={-1} tone="error" title="Coś poszło nie tak"><p>{error}</p></Alert>}

        <div className="space-y-2">
          <Label htmlFor="krotki-opis">Krótki opis</Label>
          <FieldHint id="krotki-opis-pomoc">Jedno zdanie: co chcesz zrobić.</FieldHint>
          <FieldError id="krotki-opis-blad">{fieldError}</FieldError>
          <Input
            ref={titleField}
            id="krotki-opis"
            value={fiszka.krotki_opis}
            onChange={set("krotki_opis")}
            aria-invalid={!!fieldError}
            aria-describedby={fieldError ? "krotki-opis-pomoc krotki-opis-blad" : "krotki-opis-pomoc"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="problem">Jaki problem rozwiązuje</Label>
          <Textarea id="problem" rows={3} value={fiszka.problem} onChange={set("problem")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="istota">Na czym polega</Label>
          <FieldHint id="istota-pomoc">Co konkretnie się wydarzy, kto to zrobi i gdzie.</FieldHint>
          <Textarea id="istota" rows={4} value={fiszka.istota} onChange={set("istota")} aria-describedby="istota-pomoc" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dla-kogo">Dla kogo</Label>
          <Input id="dla-kogo" value={fiszka.dla_kogo} onChange={set("dla_kogo")} />
        </div>
        <fieldset className="space-y-2">
          <legend className="font-bold">Na jakim etapie jest pomysł</legend>
          <RadioGroup value={fiszka.etap} onValueChange={(etap) => setFiszka((f) => ({ ...f, etap }))}>
            {STAGES.map((s, i) => <RadioGroupOption key={s} id={`etap-${i}`} value={s} label={s} />)}
          </RadioGroup>
        </fieldset>
      </section>

      <section aria-labelledby="asystent" className="space-y-4">
        <h2 id="asystent" className="text-2xl font-bold">Porozmawiaj z asystentem</h2>
        <p className="max-w-2xl">
          Asystent zada pytania, podsunie pomysły i sprawdzi, czy coś podobnego już działa. To nieobowiązkowe.
        </p>
        <AssistantChat fiszka={() => (fiszka.krotki_opis.trim() ? fiszka : undefined)} />
      </section>

      {canvasFields.length > 0 && (
        <details className="max-w-2xl space-y-4 rounded-[16px] bg-secondary px-5 py-4">
          <summary className="cursor-pointer text-lg font-bold">Rozpisz pomysł dokładniej (canvas, nieobowiązkowe)</summary>
          <div className="mt-4 space-y-6">
            {canvasFields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={`canvas-${f.key}`}>{f.label}</Label>
                {f.hint && <FieldHint id={`canvas-${f.key}-pomoc`}>{f.hint}</FieldHint>}
                <Textarea
                  id={`canvas-${f.key}`}
                  rows={3}
                  value={canvas[f.key] ?? ""}
                  onChange={(e) => setCanvas((c) => ({ ...c, [f.key]: e.target.value }))}
                  aria-describedby={f.hint ? `canvas-${f.key}-pomoc` : undefined}
                />
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="space-y-3">
        <p aria-live="polite" className="text-muted-foreground">{busy ? "Zapisuję pomysł…" : ""}</p>
        <Button type="button" onClick={submit} disabled={busy} className="w-full sm:w-auto">Zgłoś pomysł</Button>
        {/* Bez otwartego naboru /wniosek mówi tylko „Nabór jest zamknięty”, a fiszka przepada po powrocie. */}
        {calls.length > 0 && (
          <p className="max-w-2xl">
            Chcesz od razu przygotować wniosek o grant?{" "}
            <Link href={applicationHref} className={linkClass}>Przejdź do formularza — wstępnie uzupełnimy go tym pomysłem</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
