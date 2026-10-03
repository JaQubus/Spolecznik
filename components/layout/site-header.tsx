"use client";

import { AdjustmentsHorizontalIcon, Bars3Icon, ChevronDownIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "cn";
import { A11yToolbar } from "@/components/a11y/a11y-toolbar";

// Etykiety w UI to proste czasowniki — nazwy modułów (Społecznik·Dopasuj itd.) są tylko do pitchu.
const NAV = [
  { href: "/opisz", label: "Opisz problem" },
  { href: "/biblioteka", label: "Biblioteka i wiedza" },
  { href: "/pomysl", label: "Zgłoś pomysł" },
  { href: "/wdrozenie", label: "Jak to wdrożyć u nas?" },
  { href: "/zapytaj", label: "Zapytaj eksperta" },
  { href: "/status", label: "Sprawdź status" },
];

const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// Przycisk rozwijający: obrys = zamknięty, wypełnienie kolorem tekstu = otwarty. Bez zieleni w nagłówku.
const disclosureButton =
  "inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-border-strong px-4 text-base font-bold hover:border-foreground aria-expanded:border-foreground aria-expanded:bg-foreground aria-expanded:text-background";

/**
 * Nagłówek. Pasek dostępności jest zawsze na górze; na telefonie zwija się za przyciskiem „Dostępność”,
 * a nawigacja poniżej lg za przyciskiem „Menu”. Każdy panel otwiera się pod swoim przyciskiem,
 * więc naciśnięty przycisk się nie przesuwa, a kolejność Tab zgadza się z kolejnością na ekranie.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [a11yOpen, setA11yOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const a11yButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  // Esc zamyka panel i oddaje fokus przyciskowi, który go otworzył.
  function closeA11y(e: React.KeyboardEvent) {
    if (e.key !== "Escape" || !a11yOpen) return;
    setA11yOpen(false);
    a11yButton.current?.focus();
  }
  function closeMenu(e: React.KeyboardEvent) {
    if (e.key !== "Escape" || !menuOpen) return;
    setMenuOpen(false);
    menuButton.current?.focus();
  }

  return (
    <header className="border-b print:hidden">
      <div className="bg-secondary" onKeyDown={closeA11y}>
        <div className="mx-auto max-w-6xl px-4 md:px-5">
          <div className="flex justify-end py-2 md:hidden">
            <button
              ref={a11yButton}
              type="button"
              aria-expanded={a11yOpen}
              aria-controls="ustawienia-dostepnosci"
              onClick={() => setA11yOpen((o) => !o)}
              className={disclosureButton}
            >
              <AdjustmentsHorizontalIcon aria-hidden className="size-5" />
              Dostępność
              <ChevronDownIcon aria-hidden className={cn("size-5 transition-transform", a11yOpen && "rotate-180")} />
            </button>
          </div>
          <div id="ustawienia-dostepnosci" className={cn("pb-3 md:block md:py-1", a11yOpen ? "block" : "hidden")}>
            <A11yToolbar />
          </div>
        </div>
      </div>

      <div
        className="mx-auto max-w-6xl px-4 md:px-5 lg:flex lg:items-center lg:justify-between lg:gap-4"
        onKeyDown={closeMenu}
      >
        {/* Wiersz o stałej wysokości: otwarte menu pojawia się pod nim i niczego w nim nie przesuwa. */}
        <div className="flex min-h-20 items-center justify-between gap-4">
          <Link href="/" className="rounded-lg text-xl font-bold tracking-tight sm:text-2xl">Społecznik</Link>
          <button
            ref={menuButton}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="menu-glowne"
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(disclosureButton, "lg:hidden")}
          >
            {menuOpen ? <XMarkIcon aria-hidden className="size-5" /> : <Bars3Icon aria-hidden className="size-5" />}
            Menu
          </button>
        </div>
        <nav
          id="menu-glowne"
          aria-label="Główna"
          className={cn("lg:block", menuOpen ? "block" : "hidden")}
        >
          {/* Telefon: pełnej szerokości wiersze rozdzielone liniami. Od lg: pigułki w jednym rzędzie. */}
          <ul className="-mx-4 border-t md:-mx-5 lg:mx-0 lg:flex lg:flex-wrap lg:justify-end lg:gap-1 lg:border-0">
            {NAV.map((n) => {
              const current = isCurrent(pathname, n.href);
              return (
                <li key={n.href} className="border-b last:border-b-0 lg:border-0">
                  <Link
                    href={n.href}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-14 items-center justify-between gap-4 px-4 text-lg hover:bg-secondary aria-[current=page]:font-bold aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-[0.45em] md:px-5 lg:min-h-12 lg:rounded-full lg:px-3 lg:whitespace-nowrap"
                  >
                    {n.label}
                    <ChevronRightIcon aria-hidden className="size-5 shrink-0 lg:hidden" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
