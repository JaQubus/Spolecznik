import Link from "next/link";
import { A11yToolbar } from "@/components/a11y/a11y-toolbar";

// Etykiety w UI to proste czasowniki — nazwy modułów (hubmi.pl·Dopasuj itd.) są tylko do pitchu.
const NAV = [
  { href: "/opisz", label: "Opisz problem" },
  { href: "/biblioteka", label: "Biblioteka i wiedza" },
  { href: "/pomysl", label: "Zgłoś pomysł" },
  { href: "/wdrozenie", label: "Jak to wdrożyć u nas?" },
  { href: "/status", label: "Sprawdź status" },
];

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-2xl font-bold">hubmi.pl</Link>
        <nav aria-label="Główna">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="underline-offset-4 hover:underline">{n.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <A11yToolbar />
      </div>
    </header>
  );
}
