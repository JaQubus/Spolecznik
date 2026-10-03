"use client";

import { useId, useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { GminaOption } from "@/lib/gminy";

const MIN_CHARS = 2;
const MAX_SUGGESTIONS = 8;

// Bez wielkości liter i polskich znaków: „swiatniki” znajdzie „Świątniki Górne”. „ł” nie rozkłada się w NFD.
const fold = (s: string) =>
  s.toLocaleLowerCase("pl").normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l").trim();

// „gmina Łapanów”, „m. Kraków” — ten sam przedrostek obcina serwer (normalize w lib/gminy.ts).
const nameKey = (s: string) => fold(s.trim().replace(/^(gmina|gm\.|miasto|m\.)\s+/i, ""));

/** Najpierw nazwy zaczynające się od wpisanego tekstu, potem te, w których od niego zaczyna się dalsze słowo („wiśnicz” → Nowy Wiśnicz). */
function suggest(options: GminaOption[], query: string): GminaOption[] {
  const q = fold(query);
  if (q.length < MIN_CHARS) return [];
  const starts: GminaOption[] = [];
  const words: GminaOption[] = [];
  for (const o of options) {
    const name = fold(o.nazwa);
    if (name.startsWith(q)) starts.push(o);
    else if (name.split(/[\s-]+/).some((w) => w.startsWith(q))) words.push(o);
  }
  return [...starts, ...words].slice(0, MAX_SUGGESTIONS);
}

/** Wpisany tekst i TERYT, gdy wiadomo, o którą gminę chodzi: wybrano z listy albo nazwa pasuje tylko do jednej. */
export type GminaValue = { text: string; teryt: string | null };

export const EMPTY_GMINA: GminaValue = { text: "", teryt: null };

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange" | "defaultValue" | "autoComplete"> & {
  id: string;
  options: GminaOption[];
  value: GminaValue;
  onValueChange: (value: GminaValue) => void;
};

/**
 * Pole „Gmina” z podpowiedziami po wpisaniu kilku liter (wzorzec ARIA combobox z listą).
 * Wpis jest dowolny: podpowiedzi pomagają, ale nie blokują nazwy spoza listy.
 * Przy nazwach, które mają dwie gminy (Bochnia miejska i wiejska, dwa Bolesławy), TERYT mówi serwerowi, którą wybrano.
 */
export function GminaField({ id, options, value, onValueChange, className, "aria-describedby": describedBy, ...props }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Ostrzeżenie dopiero po wyjściu z pola (albo od razu, gdy wartość przyszła z adresu), nie w trakcie pisania.
  const [checked, setChecked] = useState(value.text.trim() !== "");
  const list = useRef<HTMLUListElement>(null);

  const items = useMemo(() => suggest(options, value.text), [options, value.text]);
  // Gmina już ustalona: lista nie jest potrzebna. Przy „Bochnia” bez wyboru zostaje, żeby wskazać którą.
  const expanded = open && items.length > 0 && !value.teryt;
  const optionId = (i: number) => `${listId}-${i}`;

  const chosen = value.teryt ? options.find((o) => o.teryt === value.teryt) : undefined;
  const ambiguous = chosen ? options.filter((o) => o.nazwa === chosen.nazwa).length > 1 : false;
  const chosenId = `${id}-wybrana`;

  const sameName = useMemo(() => options.filter((o) => nameKey(o.nazwa) === nameKey(value.text)), [options, value.text]);
  const warning = !checked || value.teryt || !value.text.trim() ? null
    : sameName.length > 1 ? `Są ${sameName.length} gminy o nazwie ${sameName[0].nazwa}. Wybierz z podpowiedzi, o którą chodzi.`
    : sameName.length === 0 ? `Nie znaleźliśmy gminy „${value.text.trim()}” w Małopolsce. Sprawdź pisownię albo wybierz gminę z podpowiedzi.`
    : null;
  const warningId = `${id}-uwaga`;

  function choose(o: GminaOption) {
    onValueChange({ text: o.nazwa, teryt: o.teryt });
    setOpen(false);
    setActive(-1);
  }

  function edit(text: string) {
    const same = options.filter((o) => nameKey(o.nazwa) === nameKey(text));
    onValueChange({ text, teryt: same.length === 1 ? same[0].teryt : null });
    setChecked(false);
    setOpen(true);
    setActive(-1);
  }

  function move(delta: number) {
    if (!expanded) {
      setOpen(true);
      return;
    }
    const next = ((active + 1 + delta + items.length + 1) % (items.length + 1)) - 1; // -1 = z powrotem w polu
    setActive(next);
    if (next >= 0) list.current?.children[next]?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" && expanded && active >= 0) { e.preventDefault(); choose(items[active]); }
    else if (e.key === "Escape" && expanded) { e.preventDefault(); setOpen(false); setActive(-1); }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          {...props}
          id={id}
          role="combobox"
          // Własna lista zastępuje autouzupełnianie przeglądarki, które zasłaniałoby podpowiedzi (TextField.md).
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          aria-describedby={[describedBy, ambiguous && chosenId, warning && warningId].filter(Boolean).join(" ") || undefined}
          value={value.text}
          onChange={(e) => edit(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => { setOpen(false); setActive(-1); setChecked(true); }}
          className={className}
        />
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label="Podpowiedzi gmin"
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border-2 border-border-strong bg-popover p-1 text-popover-foreground shadow-[var(--shadow-overlay)]"
        >
          {items.map((o, i) => (
            <li
              key={o.teryt}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // mousedown zamiast click: pole nie traci fokusu, więc lista nie znika przed wyborem.
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseMove={() => setActive(i)}
              className={cn(
                "flex min-h-12 cursor-pointer flex-col justify-center rounded-sm px-3 py-2",
                i === active && "bg-foreground text-background",
              )}
            >
              <span className="text-lg">{o.nazwa}</span>
              <span className={cn("text-base", i === active ? "text-background" : "text-muted-foreground")}>{o.opis}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Pole pokazuje samą nazwę, więc przy dwóch gminach o tej nazwie mówimy, którą wybrano. */}
      {ambiguous && chosen && <p id={chosenId} className="text-base text-muted-foreground">Wybrano: {chosen.opis}.</p>}
      {/* Nie blokuje wysłania: bez rozpoznanej gminy serwer bierze ją z opisu albo szuka bez danych o gminie. */}
      <div aria-live="polite">
        {warning && (
          <p id={warningId} className="flex items-start gap-2 text-base">
            <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span><span className="sr-only">Uwaga: </span>{warning}</span>
          </p>
        )}
      </div>
      <p role="status" className="sr-only">
        {expanded ? `Podpowiedzi: ${items.length}. Wybierz strzałkami i zatwierdź Enterem.` : ""}
      </p>
    </div>
  );
}
