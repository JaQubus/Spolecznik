import { ChevronRight } from "lucide-react";
import Link from "next/link";

/** Ścieżka nawigacji: ostatni element to bieżąca strona (aria-current), bez linku. */
export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Ścieżka nawigacji">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
        {items.map((item, n) => (
          <li key={item.label} className="flex items-center gap-2">
            {n > 0 && <ChevronRight aria-hidden className="size-4 text-muted-foreground" />}
            {item.href ? (
              <Link href={item.href} className="inline-flex min-h-12 items-center underline decoration-1 underline-offset-4 hover:decoration-2">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-bold">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
