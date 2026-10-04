import Link from "next/link";
import type { LayerKey, MapData } from "@/lib/knowledge/map";
import { MapHover, type HoverDetail } from "./map-hover";

export type TerritoryItem = {
  id: string;
  /** Pełna nazwa dostępna (np. „powiat bocheński: 2,35%. Pokaż kartę powiatu”). */
  name: string;
  /** Kolor klasy z legendy albo null, gdy brak danych. */
  fill: string | null;
  href: string;
};

export const NO_DATA_FILL = "var(--surface-sunken)";

/**
 * Kartogram gmin albo powiatów jako SVG renderowany na serwerze (granice PRG GUGiK z public/mapa/malopolska.json).
 * Każdy obszar to link do karty terytorium. Powiaty są w kolejności Tab; 183 gmin nie — klawiatura i czytnik
 * wybierają gminę polem „Znajdź gminę” nad mapą, a wartości są też w nazwach linków i w karcie po najechaniu.
 */
export function TerritoryMap({ data, layer, items, selected, title, details }: {
  data: MapData;
  layer: LayerKey;
  items: TerritoryItem[];
  selected: string | null;
  title: string;
  details: Record<string, HoverDetail>;
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const units = data.layers[layer].units;
  const focusable = units.length <= 50;
  const current = units.find((u) => u.id === selected);

  return (
    <MapHover details={details} cta={`Kliknij, żeby zobaczyć kartę ${layer === "gminy" ? "gminy" : "powiatu"}`}>
      <svg viewBox={data.viewBox} role="group" aria-label={title} className="h-auto w-full max-w-3xl">
        {units.map((u) => {
          const item = byId.get(u.id);
          if (!item) return null;
          return (
            <Link
              key={u.id}
              href={item.href}
              scroll={false}
              aria-label={item.name}
              tabIndex={focusable ? undefined : -1}
              data-id={u.id}
              className="group outline-none"
            >
              <path
                d={u.d}
                fillRule="evenodd"
                fill={item.fill ?? NO_DATA_FILL}
                stroke="var(--surface)"
                strokeWidth={0.8}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="transition-[stroke] group-hover:stroke-[var(--ink)] group-hover:[stroke-width:2.5] group-focus-visible:stroke-[var(--focus)] group-focus-visible:[stroke-width:5]"
              />
            </Link>
          );
        })}
        <g aria-hidden fill="none" pointerEvents="none" strokeLinejoin="round">
          {/* Na mapie gmin granice powiatów pomagają się zorientować. */}
          {layer === "gminy" && data.layers.powiaty.units.map((p) => (
            <path key={p.id} d={p.d} stroke="var(--ink-muted)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={data.outline} stroke="var(--ink)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {current && <path d={current.d} stroke="var(--ink)" strokeWidth={4} vectorEffect="non-scaling-stroke" />}
        </g>
        {/* Podpisy miast tylko od sm: na wąskim ekranie byłyby nieczytelne; nazwy są w linkach i w karcie. */}
        <g aria-hidden pointerEvents="none" className="max-sm:hidden">
          {data.labels.map((l) => (
            <text
              key={l.name}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={20}
              fontWeight={700}
              fill="var(--ink)"
              stroke="var(--surface)"
              strokeWidth={5}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {l.name}
            </text>
          ))}
        </g>
      </svg>
    </MapHover>
  );
}
