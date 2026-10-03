"use client";

import { useSyncExternalStore } from "react";
import { Bars3BottomLeftIcon, EyeIcon, MagnifyingGlassPlusIcon } from "@heroicons/react/24/outline";

export const A11Y_OPTIONS = [
  { key: "large", label: "Większy tekst", Icon: MagnifyingGlassPlusIcon },
  { key: "contrast", label: "Wysoki kontrast", Icon: EyeIcon },
  { key: "simple", label: "Tryb prosty", Icon: Bars3BottomLeftIcon },
] as const;

// Źródłem prawdy są klasy na <html> (np. a11y-simple); ustawia je też A11Y_INIT_SCRIPT przed hydracją.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const getSnapshot = () => document.documentElement.className;
const getServerSnapshot = () => "";

function toggle(key: string) {
  const on = document.documentElement.classList.toggle(`a11y-${key}`);
  try { localStorage.setItem(`a11y-${key}`, on ? "1" : "0"); } catch {}
}

/** Przełączniki dostępności w nagłówku. */
export function A11yToolbar() {
  const classes = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div role="group" aria-label="Ustawienia dostępności" className="flex flex-wrap gap-2 md:justify-end">
      {A11Y_OPTIONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          aria-pressed={classes.split(" ").includes(`a11y-${key}`)}
          onClick={() => toggle(key)}
          // Obrys jak w filtrach (Chip.md): bez niego niewciśnięty przełącznik na dotyku wygląda jak zwykły tekst.
          className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border-strong bg-background px-3 text-base hover:border-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:font-bold aria-pressed:text-background"
        >
          <Icon aria-hidden className="size-5" />
          {label}
        </button>
      ))}
    </div>
  );
}
