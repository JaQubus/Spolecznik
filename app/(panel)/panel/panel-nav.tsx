"use client";

import { ChevronDownIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";

const LINKS = [
  { href: "/panel", label: "Radar" },
  { href: "/panel/lejek", label: "Lejek" },
  { href: "/panel/wskazniki", label: "Wskaźniki" },
  { href: "/panel/partnerzy", label: "Partnerzy" },
  { href: "/panel/instytucje", label: "Instytucje" },
  { href: "/panel/zrodla", label: "Źródła" },
  { href: "/panel/programy", label: "Programy" },
  { href: "/panel/adopcje", label: "Adopcje" },
  { href: "/panel/przeniesienia", label: "Przeniesienia" },
  { href: "/panel/trendy", label: "Trendy" },
  { href: "/panel/wiedza", label: "Wiedza" },
] as const;

/**
 * Telefon: jeden przycisk z bieżącą sekcją, a pod nim wiersze na całą szerokość (jak główne Menu) —
 * zamiast trzech rzędów linków nad treścią. Od lg: linki w jednym rzędzie, zawsze widoczne.
 */
export function PanelNav({ sections }: { sections: readonly string[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Opiekun instytucji dostaje tylko część sekcji (lib/panel/scope.ts); reszta i tak odmówi dostępu po stronie serwera.
  const visible = LINKS.filter((l) => sections.includes(l.href));
  const current = (href: string) =>
    href === "/panel" ? path === "/panel" || path.startsWith("/panel/inicjatywy") : path.startsWith(href);
  const active = visible.find((l) => current(l.href));

  return (
    <nav aria-label="Panel" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="panel-sekcje"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-full border border-border-strong bg-background px-4 text-left text-lg hover:border-foreground aria-expanded:border-foreground lg:hidden"
      >
        <span>
          Sekcja: <strong>{active?.label ?? "Panel"}</strong>
        </span>
        <ChevronDownIcon aria-hidden className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <ul id="panel-sekcje" className={cn("mt-2 border-t lg:mt-0 lg:flex lg:flex-wrap lg:gap-x-6 lg:border-0", open ? "block" : "hidden lg:flex")}>
        {visible.map((l) => (
          <li key={l.href} className="border-b lg:border-0">
            <Link
              href={l.href}
              aria-current={current(l.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center px-1 text-lg underline decoration-1 underline-offset-4 hover:decoration-2 aria-[current=page]:font-bold aria-[current=page]:decoration-2 lg:px-0"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
