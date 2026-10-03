import Link from "next/link";
import { A11yToolbar } from "@/components/a11y/a11y-toolbar";

// Etykiety w UI to proste czasowniki — nazwy modułów (Społecznik·Dopasuj itd.) są tylko do pitchu.
const NAV = [
  { href: "/opisz", label: "Opisz problem" },
  { href: "/biblioteka", label: "Biblioteka i wiedza" },
  { href: "/pomysl", label: "Zgłoś pomysł" },
  { href: "/wdrozenie", label: "Jak to wdrożyć u nas?" },
  { href: "/status", label: "Sprawdź status" },
];

export function SiteHeader() {
  return (
    <header className="flex flex-col border-b">
      {/* Pasek dostępności: na górze od md, na telefonie pod wierszem z nazwą, żeby kliknięty przycisk się nie przesuwał. */}
      <div className="order-2 bg-secondary md:order-none">
        <div className="mx-auto flex max-w-6xl justify-start px-4 py-2 md:justify-end md:py-0">
          <A11yToolbar />
        </div>
      </div>
      <div className="order-1 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:order-none">
        <Link href="/" className="rounded-lg text-2xl font-bold tracking-tight">Społecznik</Link>
        <nav aria-label="Główna">
          <ul className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="inline-flex min-h-12 items-center rounded-full px-4 hover:bg-secondary">{n.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
