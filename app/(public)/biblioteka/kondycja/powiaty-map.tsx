import Link from "next/link";
import { cn } from "cn";
import shapes from "@/lib/powiaty-shapes.json";

export type MapItem = {
  id: string;
  /** Krótka nazwa do podpisu na mapie. */
  label: string;
  /** Pełna nazwa dostępna (np. „powiat bocheński: 23,3%. Pokaż kartę powiatu”). */
  name: string;
  /** Klasa 0–4 (0 = najmniejsze wyzwanie) albo null, gdy brak danych. */
  cls: number | null;
  href: string;
};

// Sekwencyjna skala jednego odcienia (dataviz: niebieski 150→700), ciemniej = większe wyzwanie.
export const MAP_FILLS = ["var(--map-1)", "var(--map-2)", "var(--map-3)", "var(--map-4)", "var(--map-5)"];

// Miasta na prawach powiatu leżą w środku powiatów ziemskich — rysujemy je na końcu, żeby były klikalne.
const CITIES = new Set(["krakow", "nowysacz", "tarnow"]);
const LABEL_OFFSET: Record<string, [number, number]> = {
  krakowski: [-38, -30], // środek wypada w Krakowie
  nowosadecki: [0, 18],
  tarnowski: [0, 28],
  wielicki: [-14, 0],
  bochenski: [12, 0],
};

/**
 * Kartogram powiatów jako SVG renderowany na serwerze (kształty z lib/powiaty-shapes.json, PRG GUGiK).
 * Każdy powiat to link do jego karty. Te same liczby są w tabeli pod mapą — mapa jest dodatkiem.
 */
export function PowiatyMap({ items, selected, title }: { items: MapItem[]; selected: string | null; title: string }) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = [...shapes.shapes].sort(
    (a, b) => Number(CITIES.has(a.powiat)) - Number(CITIES.has(b.powiat)) || Number(a.powiat === selected) - Number(b.powiat === selected),
  );

  return (
    <svg
      viewBox={`-4 -4 ${shapes.width + 8} ${shapes.height + 8}`}
      role="group"
      aria-label={title}
      className="h-auto w-full max-w-2xl"
    >
      {ordered.map((s) => {
        const item = byId.get(s.powiat);
        if (!item) return null;
        const isSelected = s.powiat === selected;
        return (
          <Link key={s.powiat} href={item.href} aria-label={item.name} className="group outline-none">
            <title>{item.name}</title>
            <path
              d={s.d}
              fillRule="evenodd"
              fill={item.cls == null ? "var(--surface-sunken)" : MAP_FILLS[item.cls]}
              stroke={isSelected ? "var(--ink)" : "var(--surface)"}
              strokeWidth={isSelected ? 4 : 1.5}
              strokeLinejoin="round"
              className={cn(
                "transition-[stroke] group-hover:stroke-[var(--ink)] group-hover:[stroke-width:3]",
                "group-focus-visible:stroke-[var(--focus)] group-focus-visible:[stroke-width:5]",
              )}
            />
          </Link>
        );
      })}
      {/* Podpisy tylko od md: na wąskim ekranie byłyby nieczytelne; nazwy są w tabeli i w nazwach linków. */}
      <g aria-hidden className="pointer-events-none hidden md:inline">
        {shapes.shapes.map((s) => {
          const item = byId.get(s.powiat);
          if (!item) return null;
          const [dx, dy] = LABEL_OFFSET[s.powiat] ?? [0, 0];
          return (
            <text
              key={s.powiat}
              x={s.cx + dx}
              y={s.cy + dy}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[var(--ink)] stroke-[var(--surface)] text-[14px] font-bold [paint-order:stroke] [stroke-width:3.5px]"
            >
              {item.label}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
