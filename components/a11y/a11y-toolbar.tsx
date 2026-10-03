"use client";

import { useSyncExternalStore } from "react";

export const A11Y_OPTIONS = [
  { key: "large", label: "Większy tekst" },
  { key: "contrast", label: "Wysoki kontrast" },
  { key: "simple", label: "Tryb prosty" },
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
    <div role="group" aria-label="Ustawienia dostępności" className="flex flex-wrap gap-2">
      {A11Y_OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          aria-pressed={classes.split(" ").includes(`a11y-${key}`)}
          onClick={() => toggle(key)}
          className="rounded-md border px-3 py-1.5 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
