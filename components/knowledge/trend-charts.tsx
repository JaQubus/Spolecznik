import type { Bucket, Trends } from "@/lib/knowledge/trends";
import { DOMAIN_KEYS, domainLabel, type DomainKey } from "@/lib/taxonomy";

export function periodLabel(iso: string, bucket: Bucket): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return bucket === "month"
    ? d.toLocaleDateString("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" })
    : `tydz. od ${d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}

const valueOf = (t: Trends, period: string, domain: DomainKey) =>
  t.series.find((s) => s.bucket === period && s.domain === domain)?.initiatives ?? 0;

/**
 * Małe wykresy: jeden panel na dziedzinę, ta sama skala we wszystkich, jeden kolor (ink) — tożsamość daje
 * nazwa panelu, nie kolor. SVG jest dekoracyjny (aria-hidden); te same liczby są w tabeli obok.
 * Słupki ≤ 24 px, zaokrąglony koniec 4 px, odstęp między słupkami, oś jako cienka linia.
 */
export function DomainTrendCharts({ trends: t }: { trends: Trends }) {
  const max = Math.max(1, ...t.series.map((s) => s.initiatives));
  const n = t.periods.length;
  const slot = 32;
  const bar = Math.min(24, slot - 4);
  const width = Math.max(1, n) * slot;
  const height = 120;
  const domains = DOMAIN_KEYS.map((d) => ({ domain: d, total: t.periods.reduce((s, p) => s + valueOf(t, p, d), 0) }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
      {domains.map(({ domain, total }) => (
        <li key={domain} className="space-y-2">
          <h3 className="text-lg font-bold">{domainLabel(domain)}</h3>
          <p className="text-base text-muted-foreground">Razem: {total}</p>
          <svg viewBox={`0 0 ${width} ${height + 1}`} className="h-32 w-full" preserveAspectRatio="none" aria-hidden>
            {t.periods.map((p, i) => {
              const v = valueOf(t, p, domain);
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
                    <title>{`${domainLabel(domain)}, ${periodLabel(p, t.bucket)}: ${v}`}</title>
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
export function DomainTrendTable({ trends: t }: { trends: Trends }) {
  return (
    <div role="region" aria-labelledby="tabela-trendow" tabIndex={0} className="relative overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-base">
        <caption id="tabela-trendow" className="p-3 text-left text-lg font-bold">
          Liczba nowych inicjatyw według dziedziny w kolejnych {t.bucket === "month" ? "miesiącach" : "tygodniach"}
        </caption>
        <thead>
          <tr className="border-b border-border-strong">
            <th scope="col" className="p-3 text-left">Okres</th>
            {DOMAIN_KEYS.map((d) => <th key={d} scope="col" className="p-3 text-right">{domainLabel(d)}</th>)}
          </tr>
        </thead>
        <tbody>
          {t.periods.map((p) => (
            <tr key={p} className="border-b border-border">
              <th scope="row" className="p-3 text-left font-normal whitespace-nowrap">{periodLabel(p, t.bucket)}</th>
              {DOMAIN_KEYS.map((d) => <td key={d} className="p-3 text-right tabular-nums">{valueOf(t, p, d)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
