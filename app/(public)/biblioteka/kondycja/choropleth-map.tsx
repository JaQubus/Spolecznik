import Link from "next/link";
import { cn } from "cn";
import gminyShapes from "@/lib/gminy-shapes.json";
import powiatyShapes from "@/lib/powiaty-shapes.json";

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

type Shape = { id: string; d: string; cx: number; cy: number };
type Shapes = { width: number; height: number; shapes: Shape[] };

/** Kształty z PRG GUGiK (data/powiaty_geo.py, data/gminy_geo.py) w jednym formacie. */
export const POWIAT_SHAPES: Shapes = { ...powiatyShapes, shapes: powiatyShapes.shapes.map((s) => ({ ...s, id: s.powiat })) };
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
  drawLast,
  labels,
  focusable = true,
}: {
  shapes: Shapes;
  items: MapItem[];
  selected: string | null;
  title: string;
  /** Obszary leżące w środku innych (np. miasta na prawach powiatu) rysujemy na wierzchu, żeby były klikalne. */
  drawLast?: Set<string>;
  /** Podpisy (od md) z ewentualnym przesunięciem [dx, dy]; bez tej opcji mapa nie ma podpisów. */
  labels?: { offsets?: Record<string, [number, number]> };
  /**
   * false: obszary klikalne myszą i dotykiem, ale poza kolejnością Tab. Przy 183 gminach klawiatura
   * przechodziłaby przez mapę bardzo długo — te same linki są w tabeli pod mapą.
   */
  focusable?: boolean;
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const rank = (id: string) => Number(drawLast?.has(id) ?? false) * 2 + Number(id === selected);
  const ordered = [...shapes.shapes].sort((a, b) => rank(a.id) - rank(b.id));
  const strokeWidth = shapes.shapes.length > 50 ? 0.8 : 1.5;

  return (
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
            className="group outline-none"
          >
            <title>{item.name}</title>
            <path
              d={s.d}
              fillRule="evenodd"
              fill={item.cls == null ? "var(--surface-sunken)" : MAP_FILLS[item.cls]}
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
      {/* Podpisy tylko od md: na wąskim ekranie byłyby nieczytelne; nazwy są w tabeli i w nazwach linków. */}
      {labels && (
        <g aria-hidden className="pointer-events-none hidden md:inline">
          {shapes.shapes.map((s) => {
            const item = byId.get(s.id);
            if (!item) return null;
            const [dx, dy] = labels.offsets?.[s.id] ?? [0, 0];
            return (
              <text
                key={s.id}
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
      )}
    </svg>
  );
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
