import type { Bucket, Trends } from "@/lib/knowledge/trends";
import type { AreaKey } from "@/lib/knowledge/types";
import { MWS_AREAS } from "@/lib/schemas";
import { AREA_LABELS } from "@/lib/taxonomy";

export function periodLabel(iso: string, bucket: Bucket): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return bucket === "month"
    ? d.toLocaleDateString("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" })
    : `tydz. od ${d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}

const valueOf = (t: Trends, period: string, area: AreaKey) =>
  t.series.find((s) => s.bucket === period && s.area === area)?.needs ?? 0;

/**
 * Małe wykresy: jeden panel na obszar, ta sama skala we wszystkich, jeden kolor (ink) — tożsamość daje
 * nazwa panelu, nie kolor. SVG jest dekoracyjny (aria-hidden); te same liczby są w tabeli obok.
 * Słupki ≤ 24 px, zaokrąglony koniec 4 px, odstęp między słupkami, oś jako cienka linia.
 */
export function AreaTrendCharts({ trends: t }: { trends: Trends }) {
  const max = Math.max(1, ...t.series.map((s) => s.needs));
  const n = t.periods.length;
  const slot = 32;
  const bar = Math.min(24, slot - 4);
  const width = Math.max(1, n) * slot;
  const height = 120;
  const areas = MWS_AREAS.map((a) => ({ area: a, total: t.periods.reduce((s, p) => s + valueOf(t, p, a), 0) }))
    .sort((a, b) => b.total - a.total);

  return (
    <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
      {areas.map(({ area, total }) => (
        <li key={area} className="space-y-2">
          <h3 className="text-lg font-bold">{AREA_LABELS[area]}</h3>
          <p className="text-base text-muted-foreground">Razem: {total}</p>
          <svg viewBox={`0 0 ${width} ${height + 1}`} className="h-32 w-full" preserveAspectRatio="none" aria-hidden>
            {t.periods.map((p, i) => {
              const v = valueOf(t, p, area);
              const h = (v / max) * height;
              const x = i * slot + (slot - bar) / 2;
              const r = Math.min(4, h / 2, bar / 2);
              const y = height - h;
              // Zaokrąglona góra, płaska podstawa przy osi.
              const d = h > 0
                ? `M${x},${height} V${y + r} Q${x},${y} ${x + r},${y} H${x + bar - r} Q${x + bar},${y} ${x + bar},${y + r} V${height} Z`
                : "";
              return (
                <g key={p}>
                  <rect x={i * slot} y={0} width={slot} height={height} fill="transparent">
                    <title>{`${AREA_LABELS[area]}, ${periodLabel(p, t.bucket)}: ${v}`}</title>
                  </rect>
                  {d && <path d={d} className="fill-foreground" pointerEvents="none" />}
                </g>
              );
            })}
            <line x1={0} x2={width} y1={height + 0.5} y2={height + 0.5} className="stroke-border-strong" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </svg>
          {n > 0 && (
            <p className="flex justify-between text-base text-muted-foreground">
              <span>{periodLabel(t.periods[0], t.bucket)}</span>
              <span>{periodLabel(t.periods[n - 1], t.bucket)}</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Tabela z tymi samymi danymi co wykresy. Szeroka, więc przewija się w poziomie we własnym obszarze. */
export function AreaTrendTable({ trends: t }: { trends: Trends }) {
  return (
    <div role="region" aria-labelledby="tabela-trendow" tabIndex={0} className="relative overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-base">
        <caption id="tabela-trendow" className="p-3 text-left text-lg font-bold">
          Liczba zgłoszeń według obszaru w kolejnych {t.bucket === "month" ? "miesiącach" : "tygodniach"}
        </caption>
        <thead>
          <tr className="border-b border-border-strong">
            <th scope="col" className="p-3 text-left">Okres</th>
            {MWS_AREAS.map((a) => <th key={a} scope="col" className="p-3 text-right">{AREA_LABELS[a]}</th>)}
          </tr>
        </thead>
        <tbody>
          {t.periods.map((p) => (
            <tr key={p} className="border-b border-border">
              <th scope="row" className="p-3 text-left font-normal whitespace-nowrap">{periodLabel(p, t.bucket)}</th>
              {MWS_AREAS.map((a) => <td key={a} className="p-3 text-right tabular-nums">{valueOf(t, p, a)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
