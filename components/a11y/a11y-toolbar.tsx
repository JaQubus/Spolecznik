"use client";

import { useSyncExternalStore } from "react";
import { AlignLeft, Contrast, Type } from "lucide-react";

export const A11Y_OPTIONS = [
  { key: "large", label: "Większy tekst", Icon: Type },
  { key: "contrast", label: "Wysoki kontrast", Icon: Contrast },
  { key: "simple", label: "Tryb prosty", Icon: AlignLeft },
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
    <div role="group" aria-label="Ustawienia dostępności" className="flex flex-wrap gap-1">
      {A11Y_OPTIONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          aria-pressed={classes.split(" ").includes(`a11y-${key}`)}
          onClick={() => toggle(key)}
          className="inline-flex min-h-12 items-center gap-2 rounded-full px-3 text-base hover:bg-muted aria-pressed:bg-foreground aria-pressed:font-bold aria-pressed:text-background"
        >
          <Icon aria-hidden className="size-5" />
          {label}
        </button>
      ))}
    </div>
  );
}
