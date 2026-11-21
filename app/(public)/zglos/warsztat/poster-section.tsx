"use client";

import { PhotoIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { IdeaPoster } from "@/components/pomysl/idea-poster";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Fiszka, IdeaPoster as Poster } from "@/lib/schemas";

/** Plakat razem z fiszką i canvasem, z których powstał — po zmianach w fiszce podpowiadamy odświeżenie. */
export type PosterState = { poster: Poster; source: string };

export function posterSource(fiszka: Fiszka, canvas: Record<string, string>) {
  return JSON.stringify([fiszka, Object.entries(canvas).filter(([, v]) => v.trim())]);
}

/**
 * Plakat pomysłu (wizualizacja z briefu, moduł III): Groq nie rysuje obrazów, więc plakat to tekst z /api/poster
 * narysowany w HTML i SVG. Zapisuje się razem z pomysłem, żeby ROPS zobaczył go w Panelu.
 */
export function PosterSection({
  fiszka,
  canvas,
  state,
  onChange,
  onMissingTitle,
}: {
  fiszka: Fiszka;
  canvas: Record<string, string>;
  state: PosterState | null;
  onChange: (state: PosterState) => void;
  onMissingTitle: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const source = posterSource(fiszka, canvas);
  const stale = state !== null && state.source !== source;

  async function generate() {
    if (fiszka.krotki_opis.trim().length < 3) {
      onMissingTitle();
      return;
    }
    setBusy(true);
    setError(null);
    setAnnounce("");
    try {
      const filled = Object.fromEntries(Object.entries(canvas).filter(([, v]) => v.trim()));
      const res = await fetch("/api/poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiszka, canvas: filled }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się przygotować plakatu");
      onChange({ poster: json.poster as Poster, source });
      setAnnounce("Plakat jest gotowy. Znajdziesz go poniżej.");
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie za chwilę.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div aria-live="polite" className="max-w-2xl space-y-2">
        {busy && <p className="text-muted-foreground">Rysuję plakat pomysłu. To potrwa kilka sekund.</p>}
        {!busy && announce && <p>{announce}</p>}
        {error && <Alert tone="error" title="Coś poszło nie tak"><p>{error}</p></Alert>}
      </div>
      {stale && !busy && (
        <p className="max-w-2xl">Fiszka zmieniła się od czasu, gdy powstał plakat. Odśwież go, żeby pokazywał aktualny pomysł.</p>
      )}
      <div className="flex flex-wrap gap-3 print:hidden">
        <Button type="button" variant="outline" disabled={busy} onClick={generate}>
          <PhotoIcon aria-hidden className="size-4" /> {state ? "Odśwież plakat" : "Pokaż plakat pomysłu"}
        </Button>
        {state && (
          <Button type="button" variant="link" onClick={() => window.print()}>
            <PrinterIcon aria-hidden className="size-4" /> Wydrukuj albo zapisz jako PDF
          </Button>
        )}
      </div>
      {state && <IdeaPoster poster={state.poster} />}
    </div>
  );
}
