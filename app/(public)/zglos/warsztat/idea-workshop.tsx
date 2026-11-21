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
import type { InitiativeResponse, Sketch } from "@/lib/schemas";
import { ApplicationDraft, type ActiveProgram } from "./application-draft";
import { AssistantChat } from "./assistant-chat";
import { PosterSection, posterSource, type PosterState } from "./poster-section";
import { org } from "@/lib/brand";

const TITLE_MISSING = "Nazwij pomysł w kilku słowach, np. „Wspólna pracownia robotyki dla trzech szkół”.";

export type CanvasField = { key: string; label: string; hint?: string };

const STAGES = ["Pomysł", "Plan działania", "Pilotaż", "Już działa"];
const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

export function IdeaWorkshop({
  initial,
  canvasFields,
  programs,
}: {
  initial: Partial<Sketch>;
  canvasFields: CanvasField[];
  programs: ActiveProgram[];
}) {
  const [sketch, setSketch] = useState<Sketch>({
    summary: initial.summary ?? "",
    problem: initial.problem ?? "",
    solution: initial.solution ?? "",
    beneficiaries: initial.beneficiaries ?? "",
    stage: initial.stage ?? STAGES[0],
  });
  const [canvas, setCanvas] = useState<Record<string, string>>({});
  const [poster, setPoster] = useState<PosterState | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InitiativeResponse | null>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  useEffect(() => { if (result) doneHeading.current?.focus(); }, [result]);

  const set = (key: keyof Sketch) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSketch((f) => ({ ...f, [key]: e.target.value }));

  function missingTitle() {
    setFieldError(TITLE_MISSING);
    titleField.current?.focus();
  }

  async function submit() {
    if (sketch.summary.trim().length < 3) {
      missingTitle();
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      const filled = Object.fromEntries(Object.entries(canvas).filter(([, v]) => v.trim()));
      // Plakat tylko wtedy, gdy pokazuje obecny szkic — nieaktualny wprowadziłby zespół w błąd.
      const current = poster && poster.source === posterSource(sketch, canvas) ? poster.poster : undefined;
      const res = await fetch("/api/initiatives/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sketch, canvas: filled, poster: current }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się zapisać pomysłu");
      setResult(json as InitiativeResponse);
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
                Twój kod zgłoszenia: <strong className="font-mono text-2xl tracking-wider whitespace-nowrap">{result.initiative.statusCode}</strong>
              </p>
              <p>
                Zapisz go. Po tym kodzie sprawdzisz, co dzieje się z pomysłem — bez zakładania konta.{" "}
                <Link href={`/status/${result.initiative.statusCode}`} className={linkClass}>Sprawdź status</Link>
              </p>
              <p>
                Ta przeglądarka zapamięta pomysł, więc tutaj kod nie będzie potrzebny:{" "}
                <Link href="/status" className={linkClass}>Twoje zgłoszenia na tym urządzeniu</Link>.
              </p>
            </div>
            <PrivateLink code={result.initiative.statusCode} accessKey={result.initiative.accessKey} />
            <EmailOptIn code={result.initiative.statusCode} accessKey={result.initiative.accessKey} />
          </div>
          <p className="max-w-2xl">
            Zespół {org.short} przeczyta pomysł i odpisze w{" "}
            <Link href={`/rozmowy?kod=${result.initiative.statusCode}`} className={linkClass}>rozmowie o zgłoszeniu</Link>. Może też
            zaprosić do niej mentora.
          </p>
        </div>
        {programs.length > 0 && <ApplicationDraft initiativeId={result.initiative.id} programs={programs} />}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section aria-labelledby="szkic" className="max-w-2xl space-y-6">
        <h2 id="szkic" className="text-2xl font-bold">Szkic pomysłu</h2>
        {error && <Alert ref={errorBox} tabIndex={-1} tone="error" title="Coś poszło nie tak"><p>{error}</p></Alert>}

        <div className="space-y-2">
          <Label htmlFor="krotki-opis">Krótki opis</Label>
          <FieldHint id="krotki-opis-pomoc">Jedno zdanie: co chcesz zrobić.</FieldHint>
          <FieldError id="krotki-opis-blad">{fieldError}</FieldError>
          <Input
            ref={titleField}
            id="krotki-opis"
            value={sketch.summary}
            onChange={set("summary")}
            aria-invalid={!!fieldError}
            aria-describedby={fieldError ? "krotki-opis-pomoc krotki-opis-blad" : "krotki-opis-pomoc"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="problem">Jaki problem rozwiązuje</Label>
          <Textarea id="problem" rows={3} value={sketch.problem} onChange={set("problem")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="istota">Na czym polega</Label>
          <FieldHint id="istota-pomoc">Co konkretnie się wydarzy, kto to zrobi i gdzie.</FieldHint>
          <Textarea id="istota" rows={4} value={sketch.solution} onChange={set("solution")} aria-describedby="istota-pomoc" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dla-kogo">Dla kogo</Label>
          <Input id="dla-kogo" value={sketch.beneficiaries} onChange={set("beneficiaries")} />
        </div>
        <fieldset className="space-y-2">
          <legend className="font-bold">Na jakim etapie jest pomysł</legend>
          <RadioGroup value={sketch.stage} onValueChange={(stage) => setSketch((f) => ({ ...f, stage }))}>
            {STAGES.map((s, i) => <RadioGroupOption key={s} id={`etap-${i}`} value={s} label={s} />)}
          </RadioGroup>
        </fieldset>
      </section>

      <section aria-labelledby="asystent" className="space-y-4">
        <h2 id="asystent" className="text-2xl font-bold">Porozmawiaj z asystentem</h2>
        <p className="max-w-2xl">
          Asystent zada pytania, podsunie pomysły i sprawdzi, czy coś podobnego już działa. To nieobowiązkowe.
        </p>
        <AssistantChat sketch={() => (sketch.summary.trim() ? sketch : undefined)} />
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

      <section aria-labelledby="plakat" className="space-y-4">
        <h2 id="plakat" className="text-2xl font-bold">Plakat pomysłu</h2>
        <p className="max-w-2xl">
          Asystent narysuje ze szkicu plakat: jak działa pomysł, co daje i czego potrzeba. Przyda się, gdy pokażesz pomysł
          w szkole, na uczelni, w urzędzie albo w programie wsparcia. Plakat nie jest obowiązkowy — jeśli go pokażesz, wyślemy go razem z pomysłem.
        </p>
        <PosterSection sketch={sketch} canvas={canvas} state={poster} onChange={setPoster} onMissingTitle={missingTitle} />
      </section>

      <div className="space-y-3">
        <p aria-live="polite" className="text-muted-foreground">{busy ? "Zapisuję pomysł…" : ""}</p>
        <Button type="button" onClick={submit} disabled={busy} className="w-full sm:w-auto">Zgłoś pomysł</Button>
      </div>
    </div>
  );
}
