import Link from "next/link";
import { cn } from "cn";

export const TABS = [
  { key: "dziedziny", label: "Dziedziny" },
  { key: "rozwiazania", label: "Sprawdzone rozwiązania z Polski" },
  { key: "materialy", label: "Materiały" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];

export const parseTab = (v: string): TabKey => (TABS.some((t) => t.key === v) ? (v as TabKey) : "dziedziny");

/**
 * Zakładki jako linki z ?tab= (stan w adresie: działa „Wstecz”, można wysłać link).
 * To nawigacja między widokami, więc <nav> z aria-current, a nie role="tablist".
 */
export function SectionTabs({ current }: { current: TabKey }) {
  return (
    <nav aria-label="Działy bazy wiedzy" className="border-b border-border">
      <ul className="flex flex-wrap gap-x-2">
        {TABS.map((t) => (
          <li key={t.key}>
            <Link
              href={`/wiedza?tab=${t.key}#dzialy`}
              scroll={false}
              aria-current={t.key === current ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-12 items-center border-b-4 border-transparent px-4 py-2 text-lg hover:border-border-strong",
                "aria-[current=page]:border-foreground aria-[current=page]:font-bold",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
