import { LogOut } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { logout } from "@/app/(public)/logowanie/actions";
import type { Viewer } from "@/lib/auth";

const LINKS = [
  { href: "/panel/trendy", label: "Trendy potrzeb" },
  { href: "/panel/wiedza", label: "Zarządzaj wiedzą" },
];

/** Nawigacja panelu ROPS: widoki Zasobnika wiedzy dostępne tylko dla administratora. */
export function PanelNav({ current, viewer }: { current: string; viewer: Viewer }) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
      <nav aria-label="Panel administratora">
        <ul className="flex flex-wrap gap-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={current === l.href ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-12 items-center rounded-full px-4 text-lg hover:bg-secondary",
                  "aria-[current=page]:bg-foreground aria-[current=page]:font-bold aria-[current=page]:text-background",
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action={logout} className="flex flex-wrap items-center gap-3 text-base">
        <span>{viewer.label}</span>
        <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 underline decoration-1 underline-offset-4 hover:bg-secondary">
          <LogOut aria-hidden className="size-5" />Wyloguj się
        </button>
      </form>
    </div>
  );
}
