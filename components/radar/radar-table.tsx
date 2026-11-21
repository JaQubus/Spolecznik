import { cn } from "cn";
import type { RadarAssessment } from "@/lib/radar/score";
import { innovationKindLabel, RADAR, RADAR_KEYS } from "@/lib/taxonomy";

/**
 * Ocena radaru jako tabela: wymiar, ocena 0–5 z paskiem (pasek tylko wizualnie, liczba jest w tekście), uzasadnienie
 * i cytat z karty. W Panelu (showRules) także reguły, które zmieniły ocenę modelu.
 */
export function RadarTable({ radar, id, showRules = false, className }: { radar: RadarAssessment; id: string; showRules?: boolean; className?: string }) {
  const weights = RADAR.weights[radar.weights] ?? RADAR.weights.domyslne;
  return (
    <div role="region" aria-labelledby={`${id}-caption`} tabIndex={0} className={cn("relative max-w-[56rem] overflow-x-auto", className)}>
      <table className="w-full border-collapse text-base">
        <caption id={`${id}-caption`} className="mb-3 text-left text-muted-foreground">
          Ocena 0–5 w każdym wymiarze. Wagi dla typu „{radar.weights === "domyslne" ? "nieznany" : innovationKindLabel(radar.weights)}”.
          Pewność oceny: {Math.round(radar.confidence * 100)} na 100 (część wymiarów opartych na treści opisu).
        </caption>
        <thead>
          <tr className="border-b border-border-strong">
            <th scope="col" className="p-3 text-left">Wymiar</th>
            <th scope="col" className="p-3 text-left">Ocena</th>
            <th scope="col" className="p-3 text-left">Dlaczego</th>
          </tr>
        </thead>
        <tbody>
          {RADAR_KEYS.map((k) => {
            const d = radar.dimensions[k];
            const def = RADAR.dimensions[k];
            return (
              <tr key={k} className="border-b border-border align-top">
                <th scope="row" className="p-3 text-left">
                  {def.label}
                  <span className="block text-sm font-normal text-muted-foreground">waga {Math.round(weights[k] * 100)}%</span>
                </th>
                <td className="p-3 whitespace-nowrap">
                  <span className="font-bold tabular-nums">{d.score} na 5</span>
                  <span aria-hidden className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={cn("h-2 w-4 rounded-sm", n <= d.score ? "bg-primary" : "bg-secondary")} />
                    ))}
                  </span>
                </td>
                <td className="p-3">
                  {d.why && <p>{d.why}</p>}
                  <p className="text-muted-foreground">
                    {d.basis === "brak_danych"
                      ? "Opis o tym nie mówi, więc ocena jest ograniczona."
                      : d.evidence ? <>Z opisu: „{d.evidence}”</> : null}
                  </p>
                  {showRules && d.rules.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {d.rules.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Mocne strony i ryzyka z oceny — listy tekstowe pod tabelą. */
export function RadarNotes({ radar }: { radar: RadarAssessment }) {
  if (radar.strengths.length === 0 && radar.risks.length === 0) return null;
  return (
    <div className="grid max-w-[56rem] gap-6 sm:grid-cols-2">
      {radar.strengths.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Mocne strony</h3>
          <ul className="list-disc space-y-1 pl-5">{radar.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      {radar.risks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Ryzyka i braki w opisie</h3>
          <ul className="list-disc space-y-1 pl-5">{radar.risks.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
