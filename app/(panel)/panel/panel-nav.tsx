"use client";

import { ChevronDownIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";

const LINKS = [
  { href: "/panel", label: "Zgłoszenia" },
  { href: "/panel/pomysly", label: "Pomysły" },
  { href: "/panel/nabory", label: "Nabory" },
  { href: "/panel/testy", label: "Testy" },
  { href: "/panel/trendy", label: "Trendy" },
  { href: "/panel/wiedza", label: "Wiedza" },
] as const;

/**
 * Telefon: jeden przycisk z bieżącą sekcją, a pod nim wiersze na całą szerokość (jak główne Menu) —
 * zamiast trzech rzędów linków nad treścią. Od lg: linki w jednym rzędzie, zawsze widoczne.
 */
export function PanelNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = (href: string) =>
    href === "/panel" ? path === "/panel" || path.startsWith("/panel/zgloszenia") : path.startsWith(href);
  const active = LINKS.find((l) => current(l.href));

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
        {LINKS.map((l) => (
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
