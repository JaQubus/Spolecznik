"use client";

import { AdjustmentsHorizontalIcon, Bars3Icon, ChevronDownIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "cn";
import { A11yToolbar } from "@/components/a11y/a11y-toolbar";
import { LogoMark } from "./logo-mark";
import { NotificationBell } from "./notification-bell";

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

// Od lg nawigacja to jeden rząd pigułek. Co się nie mieści (wąskie okno, „Większy tekst”), idzie do „Więcej”.
const LG = "(min-width: 1024px)";
const NAV_GAP = 4; // lg:gap-1
const pill = "inline-flex min-h-12 items-center rounded-full px-3 text-lg whitespace-nowrap";

// Przycisk rozwijający: obrys = zamknięty, wypełnienie kolorem tekstu = otwarty. Bez zieleni w nagłówku.
const disclosureButton =
  "inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-border-strong px-4 text-base font-bold hover:border-foreground aria-expanded:border-foreground aria-expanded:bg-foreground aria-expanded:text-background";

/**
 * Nagłówek. Pasek dostępności jest zawsze na górze; na telefonie zwija się za przyciskiem „Dostępność”,
 * a nawigacja poniżej lg za przyciskiem „Menu”. Od lg pozycje, które nie mieszczą się w jednym rzędzie, są w „Więcej”. Każdy panel otwiera się pod swoim przyciskiem,
 * więc naciśnięty przycisk się nie przesuwa, a kolejność Tab zgadza się z kolejnością na ekranie.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [a11yOpen, setA11yOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const a11yButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  // Ile pozycji mieści się w rzędzie (od lg); null = jeszcze nie zmierzone, wtedy rząd się zawija jak dawniej.
  const [inline, setInline] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const measure = useRef<HTMLUListElement>(null);
  const moreItem = useRef<HTMLLIElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);

  // Pomiar na niewidocznej kopii pozycji: szerokości znamy też dla tych, które są akurat w „Więcej”.
  // ResizeObserver woła fit od razu po observe, a potem przy każdej zmianie okna albo rozmiaru tekstu.
  useLayoutEffect(() => {
    const navEl = nav.current, measureEl = measure.current;
    if (!navEl || !measureEl) return;
    const lg = window.matchMedia(LG);
    const fit = () => {
      if (!lg.matches) return setInline(NAV.length);
      const widths = [...measureEl.children].map((c) => c.getBoundingClientRect().width);
      const more = widths.pop() ?? 0;
      const row = (n: number) => widths.slice(0, n).reduce((a, w) => a + w, 0) + Math.max(0, n - 1) * NAV_GAP;
      const avail = navEl.clientWidth;
      if (row(widths.length) <= avail) return setInline(widths.length);
      let n = widths.length - 1;
      while (n > 0 && row(n) + NAV_GAP + more > avail) n--;
      setInline(n);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(navEl);
    ro.observe(measureEl);
    lg.addEventListener("change", fit);
    return () => { ro.disconnect(); lg.removeEventListener("change", fit); };
  }, []);

  // Klik poza „Więcej” zamyka listę.
  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (e: PointerEvent) => { if (!moreItem.current?.contains(e.target as Node)) setMoreOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [moreOpen]);

  // Esc zamyka panel i oddaje fokus przyciskowi, który go otworzył.
  function closeA11y(e: React.KeyboardEvent) {
    if (e.key !== "Escape" || !a11yOpen) return;
    setA11yOpen(false);
    a11yButton.current?.focus();
  }
  function closeMore(e: React.KeyboardEvent) {
    if (e.key !== "Escape" || !moreOpen) return;
    e.stopPropagation();
    setMoreOpen(false);
    moreButton.current?.focus();
  }
  function closeMenu(e: React.KeyboardEvent) {
    if (e.key !== "Escape" || !menuOpen) return;
    setMenuOpen(false);
    menuButton.current?.focus();
  }

  return (
    <header className="border-b print:hidden">
      <div className="bg-secondary" onKeyDown={closeA11y}>
        {/* Dzwonek (tylko po zalogowaniu) po lewej, dostępność po prawej. Na wąskim ekranie zawijają się w dwa wiersze;
            kolejność w kodzie = kolejność na ekranie, więc Tab idzie tak, jak widać. */}
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:px-5 md:py-1">
          <NotificationBell buttonClassName={disclosureButton} />
          <button
            ref={a11yButton}
            type="button"
            aria-expanded={a11yOpen}
            aria-controls="ustawienia-dostepnosci"
            onClick={() => setA11yOpen((o) => !o)}
            className={cn(disclosureButton, "ml-auto md:hidden")}
          >
            <AdjustmentsHorizontalIcon aria-hidden className="size-5" />
            Dostępność
            <ChevronDownIcon aria-hidden className={cn("size-5 transition-transform", a11yOpen && "rotate-180")} />
          </button>
          <div id="ustawienia-dostepnosci" className={cn("basis-full pb-1 md:ml-auto md:block md:basis-auto md:pb-0", a11yOpen ? "block" : "hidden")}>
            <A11yToolbar />
          </div>
        </div>
      </div>

      <div
        className="mx-auto max-w-screen-2xl px-4 md:px-5 lg:flex lg:items-center lg:gap-6"
        onKeyDown={closeMenu}
      >
        {/* Wiersz o stałej wysokości: otwarte menu pojawia się pod nim i niczego w nim nie przesuwa. Przy 320 px z „Większym
            tekstem” logo i „Menu” się nie mieszczą — wtedy „Menu” schodzi do drugiego wiersza (po prawej), zamiast wystawać. */}
        <div className="flex min-h-20 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 lg:shrink-0">
          <Link href="/" className="inline-flex min-h-12 items-center gap-3 rounded-lg text-xl font-bold tracking-tight sm:text-2xl">
            <LogoMark className="size-9 shrink-0 sm:size-10" />
            Społecznik
          </Link>
          <button
            ref={menuButton}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="menu-glowne"
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(disclosureButton, "ml-auto lg:hidden")}
          >
            {menuOpen ? <XMarkIcon aria-hidden className="size-5" /> : <Bars3Icon aria-hidden className="size-5" />}
            Menu
          </button>
        </div>
        <nav
          ref={nav}
          id="menu-glowne"
          aria-label="Główna"
          className={cn("relative lg:block lg:min-w-0 lg:flex-1", menuOpen ? "block" : "hidden")}
        >
          {/* Niewidoczna kopia do pomiaru: bez linków i poza drzewem dostępności (visibility: hidden). Kontener 0×0 z overflow
              hidden, żeby pełna szerokość kopii nie wydłużała strony w poziomie — pomiar i tak widzi jej prawdziwą szerokość. */}
          <div aria-hidden className="pointer-events-none invisible absolute top-0 left-0 size-0 overflow-hidden">
            <ul ref={measure} className="hidden w-max gap-1 lg:flex">
              {NAV.map((n) => (
                <li key={n.href} className={cn(pill, isCurrent(pathname, n.href) && "font-bold")}>{n.label}</li>
              ))}
              <li className={cn(pill, "gap-1")}>Więcej<span className="size-5" /></li>
            </ul>
          </div>
          {/* Telefon: pełnej szerokości wiersze rozdzielone liniami. Od lg: pigułki w jednym rzędzie, nadmiar w „Więcej”. */}
          <ul className={cn("-mx-4 border-t md:-mx-5 lg:mx-0 lg:flex lg:justify-end lg:gap-1 lg:border-0", inline === null && "lg:flex-wrap")}>
            {NAV.map((n, i) => {
              const current = isCurrent(pathname, n.href);
              return (
                <li key={n.href} className={cn("border-b last:border-b-0 lg:border-0", inline !== null && i >= inline && "lg:hidden")}>
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
            {inline !== null && inline < NAV.length && (
              <li ref={moreItem} className="relative hidden lg:block" onKeyDown={closeMore}>
                <button
                  ref={moreButton}
                  type="button"
                  aria-expanded={moreOpen}
                  aria-controls="menu-wiecej"
                  onClick={() => setMoreOpen((o) => !o)}
                  className={cn(
                    pill,
                    "gap-1 hover:bg-secondary aria-expanded:bg-foreground aria-expanded:text-background",
                    // Bieżąca strona jest w „Więcej” — oznaczamy przycisk tak jak bieżącą pozycję.
                    NAV.slice(inline).some((n) => isCurrent(pathname, n.href)) && "font-bold underline decoration-2 underline-offset-[0.45em]",
                  )}
                >
                  Więcej
                  <ChevronDownIcon aria-hidden className={cn("size-5 transition-transform", moreOpen && "rotate-180")} />
                </button>
                <ul
                  id="menu-wiecej"
                  hidden={!moreOpen}
                  className="absolute top-full right-0 z-50 mt-2 min-w-64 rounded-[16px] border-2 border-border-strong bg-background p-2 shadow-[var(--shadow-overlay)]"
                >
                  {NAV.slice(inline).map((n) => (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        aria-current={isCurrent(pathname, n.href) ? "page" : undefined}
                        onClick={() => setMoreOpen(false)}
                        className="flex min-h-12 items-center rounded-lg px-3 text-lg whitespace-nowrap hover:bg-secondary aria-[current=page]:font-bold aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-[0.45em]"
                      >
                        {n.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
