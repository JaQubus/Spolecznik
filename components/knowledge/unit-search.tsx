"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useId, useMemo, useState } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MapUnit } from "@/lib/knowledge/map";
import { plural } from "@/lib/pl";

const MAX_RESULTS = 8;

/** Bez wielkości liter i polskich znaków: „zabk” znajdzie „Żabno”, „lacko” — „Łącko”. */
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/gi, "l").toLowerCase();

/**
 * Pole „Znajdź gminę / powiat” z podpowiedziami (wzorzec ARIA combobox z listą). 183 gminy to za dużo na listę
 * rozwijaną — tu wystarczy wpisać kilka liter. Strzałki wybierają podpowiedź, Enter zatwierdza, Escape zamyka.
 */
export function UnitSearch({ id, label, units, describe, selected, onSelect, className }: {
  id: string;
  label: string;
  units: MapUnit[];
  /** Druga linijka podpowiedzi, np. „gmina miejska, powiat tatrzański”. */
  describe: (u: MapUnit) => string | null;
  selected?: string;
  onSelect: (id: string | undefined) => void;
  className?: string;
}) {
  // null = pole pokazuje nazwę wybranej jednostki; tekst = to, co ktoś właśnie wpisuje.
  const [typed, setTyped] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const hintId = useId();
  const current = units.find((u) => u.id === selected);
  const query = typed ?? current?.name ?? "";

  const results = useMemo(() => {
    const q = norm(typed ?? "").trim();
    if (!q) return [];
    const score = (u: MapUnit) => {
      const name = norm(u.name);
      if (name.startsWith(q)) return 0;
      if (name.split(/[\s-]+/).some((w) => w.startsWith(q))) return 1;
      if (name.includes(q)) return 2;
      return norm(describe(u) ?? "").includes(q) ? 3 : -1;
    };
    return units
      .map((u) => ({ u, s: score(u) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => a.s - b.s || a.u.name.localeCompare(b.u.name, "pl"))
      .slice(0, MAX_RESULTS)
      .map((r) => r.u);
  }, [typed, units, describe]);

  const open = typed != null && typed.trim() !== "";
  const activeIndex = Math.min(active, results.length - 1);

  function choose(u: MapUnit) {
    onSelect(u.id);
    setTyped(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, results.length - 1));
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && results[activeIndex]) choose(results[activeIndex]);
      else if (typed?.trim() === "") { onSelect(undefined); setTyped(null); }
    } else if (e.key === "Escape") {
      if (typed != null) { e.preventDefault(); setTyped(null); }
    }
  }

  return (
    <div className={cn("relative grid w-full max-w-xl gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <p id={hintId} className="text-base text-muted-foreground">Wpisz kilka liter nazwy, np. Wieliczka.</p>
      <div className="relative">
        <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={hintId}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined}
          value={query}
          onChange={(e) => { setTyped(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          onBlur={() => setTyped(null)}
          className="pl-12"
        />
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={`Podpowiedzi: ${label.toLowerCase()}`}
        hidden={!open || results.length === 0}
        className="absolute top-full z-20 mt-1 max-h-96 w-full overflow-auto rounded-lg border-2 border-foreground bg-popover py-1 text-popover-foreground shadow-[var(--shadow-overlay)]"
      >
        {results.map((u, i) => (
          <li
            key={u.id}
            id={`${listId}-${u.id}`}
            role="option"
            aria-selected={i === activeIndex}
            // mousedown tylko zatrzymuje fokus w polu (inaczej onBlur zamknie listę przed kliknięciem); wybór dopiero na click,
            // żeby dało się go anulować odsunięciem kursora przed puszczeniem przycisku (WCAG 2.5.2).
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(u)}
            onMouseMove={() => setActive(i)}
            className="flex min-h-12 cursor-pointer flex-col justify-center px-4 py-2 aria-selected:bg-accent"
          >
            <span className="text-lg font-bold">{u.name}</span>
            {describe(u) && <span className="text-base text-muted-foreground">{describe(u)}</span>}
          </li>
        ))}
      </ul>
      {open && results.length === 0 && (
        <p className="absolute top-full z-20 mt-1 w-full rounded-lg border-2 border-foreground bg-popover px-4 py-3 text-lg text-popover-foreground shadow-[var(--shadow-overlay)]">
          Nie znaleziono „{typed?.trim()}”. Sprawdź pisownię.
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {open && (results.length
          ? `${results.length} ${plural(results.length, "podpowiedź", "podpowiedzi", "podpowiedzi")}. Wybierz strzałkami i zatwierdź klawiszem Enter.`
          : "Brak podpowiedzi.")}
      </p>
    </div>
  );
}
