"use client";

import { CursorArrowRaysIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";

const CARD_WIDTH = 288; // w-72
const GAP = 16;

export type HoverDetail = {
  title: string;
  subtitle?: string;
  /** Wiersze „etykieta: wartość”; `swatch` to kolor klasy na mapie (tylko przy temacie, który koloruje mapę). */
  rows: { label: string; value: string; swatch?: string; current?: boolean }[];
};

/**
 * Karta po najechaniu na obszar mapy. To dodatek dla myszy: te same liczby są w nazwie linku
 * (czytnik ekranu) i w tabeli pod mapą. Esc chowa kartę (SC 1.4.13), a karta nie przykrywa kursora.
 */
export function MapHover({ details, children }: { details: Record<string, HoverDetail>; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ id: string; left: number; top: number } | null>(null);

  function move(e: React.PointerEvent) {
    if (e.pointerType === "touch") return; // na dotyku kliknięcie od razu otwiera kartę gminy
    const el = (e.target as Element).closest("[data-id]");
    const id = el?.getAttribute("data-id");
    const rect = box.current?.getBoundingClientRect();
    if (!id || !rect || !details[id]) return setHover(null);
    // Karta obok kursora; gdy brakuje miejsca z prawej, po lewej; nigdy poza obszarem mapy.
    const x = e.clientX - rect.left;
    const width = Math.min(CARD_WIDTH, rect.width);
    const left = x + GAP + width <= rect.width ? x + GAP : x - GAP - width >= 0 ? x - GAP - width : rect.width - width;
    setHover({ id, left, top: e.clientY - rect.top + GAP });
  }

  // Esc działa niezależnie od tego, gdzie jest fokus — kursor nad mapą nie przenosi fokusu.
  const open = hover != null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setHover(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const d = hover && details[hover.id];
  return (
    <div
      ref={box}
      className="relative"
      onPointerMove={move}
      onPointerLeave={() => setHover(null)}
    >
      {children}
      {d && hover && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 w-72 max-w-full space-y-2 rounded-[16px] border border-border bg-background px-4 py-3 text-base shadow-[var(--shadow-overlay)]"
          style={{ top: hover.top, left: hover.left }}
        >
          <div>
            <p className="text-lg leading-tight font-bold">{d.title}</p>
            {d.subtitle && <p className="text-muted-foreground">{d.subtitle}</p>}
          </div>
          <dl className="space-y-1">
            {d.rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3">
                <dt className="flex items-center gap-2">
                  {r.swatch && <span className="size-3 shrink-0 rounded-[3px] border border-border-strong" style={{ background: r.swatch }} />}
                  <span className={r.current ? "font-bold" : undefined}>{r.label}</span>
                </dt>
                <dd className="font-bold whitespace-nowrap">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="flex items-center gap-2 text-muted-foreground">
            <CursorArrowRaysIcon aria-hidden className="size-4 shrink-0" /> Kliknij, żeby zobaczyć kartę gminy
          </p>
        </div>
      )}
    </div>
  );
}
