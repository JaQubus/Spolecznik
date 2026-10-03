import Link from "next/link";
import { cn } from "cn";
import gminyShapes from "@/lib/gminy-shapes.json";
import { MapHover, type HoverDetail } from "./map-hover";

export type MapItem = {
  id: string;
  /** Pełna nazwa dostępna (np. „Bochnia (gmina miejska…): 22,5%. Pokaż kartę gminy”). */
  name: string;
  /** Klasa 0–4 (0 = najmniejsze wyzwanie) albo null, gdy brak danych. */
  cls: number | null;
  /** Własny kolor zamiast klasy (np. skala z lib/knowledge/map na mapie powiatów); null = brak danych. */
  fill?: string | null;
  href: string;
};

type Shape = { id: string; d: string; cx: number; cy: number };
type Shapes = { width: number; height: number; shapes: Shape[] };

/** Kształty gmin z PRG GUGiK (data/gminy_geo.py). */
export const GMINA_SHAPES: Shapes = { ...gminyShapes, shapes: gminyShapes.shapes.map((s) => ({ ...s, id: s.teryt })) };

// Sekwencyjna skala jednego odcienia (dataviz: niebieski 150→700), ciemniej = większe wyzwanie.
export const MAP_FILLS = ["var(--map-1)", "var(--map-2)", "var(--map-3)", "var(--map-4)", "var(--map-5)"];

/**
 * Kartogram jako SVG renderowany na serwerze. Każdy obszar to link do jego karty.
 * Te same liczby są w tabeli pod mapą — mapa jest dodatkiem, nie jedynym dostępem do danych.
 */
export function ChoroplethMap({
  shapes,
  items,
  selected,
  title,
  focusable = true,
  details,
}: {
  shapes: Shapes;
  items: MapItem[];
  selected: string | null;
  title: string;
  /**
   * false: obszary klikalne myszą i dotykiem, ale poza kolejnością Tab. Przy 183 gminach klawiatura
   * przechodziłaby przez mapę bardzo długo — te same linki są w tabeli pod mapą.
   */
  focusable?: boolean;
  /** Treść karty po najechaniu myszą, po id obszaru. */
  details?: Record<string, HoverDetail>;
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  // Wybrany obszar na końcu, żeby gruba ramka nie chowała się pod sąsiadami.
  const ordered = [...shapes.shapes].sort((a, b) => Number(a.id === selected) - Number(b.id === selected));
  const strokeWidth = shapes.shapes.length > 50 ? 0.8 : 1.5;

  const map = (
    <svg
      viewBox={`-4 -4 ${shapes.width + 8} ${shapes.height + 8}`}
      role="group"
      aria-label={title}
      className="h-auto w-full max-w-2xl"
    >
      {ordered.map((s) => {
        const item = byId.get(s.id);
        if (!item) return null;
        const isSelected = s.id === selected;
        return (
          <Link
            key={s.id}
            href={item.href}
            aria-label={item.name}
            tabIndex={focusable ? undefined : -1}
            data-id={s.id}
            className="group outline-none"
          >
            <path
              d={s.d}
              fillRule="evenodd"
              fill={(item.fill !== undefined ? item.fill : item.cls == null ? null : MAP_FILLS[item.cls]) ?? "var(--surface-sunken)"}
              stroke={isSelected ? "var(--ink)" : "var(--surface)"}
              strokeWidth={isSelected ? 4 : strokeWidth}
              strokeLinejoin="round"
              className={cn(
                "transition-[stroke] group-hover:stroke-[var(--ink)] group-hover:[stroke-width:3]",
                "group-focus-visible:stroke-[var(--focus)] group-focus-visible:[stroke-width:5]",
              )}
            />
          </Link>
        );
      })}
    </svg>
  );
  return details ? <MapHover details={details}>{map}</MapHover> : map;
}

/** Legenda klas kartogramu: kolor + zakres wartości słowami (kolor nigdy nie jest jedyną informacją). */
export function MapLegend({ title, entries, note, missing = false }: { title: string; entries: { c: number; text: string }[]; note: string; missing?: boolean }) {
  return (
    <figcaption className="max-w-2xl space-y-3">
      <p className="font-bold">{title}</p>
      <ul aria-label="Legenda mapy" className="flex flex-wrap gap-x-5 gap-y-2 text-base">
        {entries.map((l) => (
          <li key={l.c} className="inline-flex items-center gap-2">
            <span aria-hidden className="size-5 shrink-0 rounded-[4px] border border-border-strong" style={{ background: MAP_FILLS[l.c] }} />
            {l.text}
          </li>
        ))}
        {missing && (
          <li className="inline-flex items-center gap-2">
            <span aria-hidden className="size-5 shrink-0 rounded-[4px] border border-border-strong bg-[var(--surface-sunken)]" />
            brak danych
          </li>
        )}
      </ul>
      <p className="text-base text-muted-foreground">{note}</p>
    </figcaption>
  );
}
