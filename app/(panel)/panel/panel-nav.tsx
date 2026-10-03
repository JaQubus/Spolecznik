"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/panel", label: "Zgłoszenia" },
  { href: "/panel/pomysly", label: "Pomysły" },
  { href: "/panel/nabory", label: "Nabory" },
  { href: "/panel/trendy", label: "Trendy" },
  { href: "/panel/wiedza", label: "Wiedza" },
] as const;

const linkClass =
  "text-lg underline decoration-1 underline-offset-4 hover:decoration-2 aria-[current=page]:font-bold aria-[current=page]:decoration-2";

export function PanelNav() {
  const path = usePathname();
  const current = (href: string) =>
    href === "/panel" ? path === "/panel" || path.startsWith("/panel/zgloszenia") : path.startsWith(href);
  return (
    <nav aria-label="Panel">
      <ul className="flex flex-wrap gap-6">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} aria-current={current(l.href) ? "page" : undefined} className={linkClass}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
