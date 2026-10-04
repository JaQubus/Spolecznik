import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { cn } from "cn";
import { InnovationList } from "@/components/knowledge/tiles";
import { knowledge } from "@/lib/knowledge";
import { TYPE_LABELS } from "@/lib/knowledge/labels";
import { INNOVATION_TYPES, type AreaKey, type GroupKey, type InnovationType } from "@/lib/knowledge/types";
import { plural } from "@/lib/pl";
import { GROUPS, MWS_AREAS } from "@/lib/schemas";
import { AREA_LABELS, GROUP_LABELS } from "@/lib/taxonomy";

export type LibraryParams = { area?: AreaKey; group?: GroupKey; types: InnovationType[]; page: number };

const PER_PAGE = 15;

export function parseLibraryParams(sp: Record<string, string | string[] | undefined>): LibraryParams {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const many = (k: string) => (Array.isArray(sp[k]) ? sp[k] : sp[k] ? [sp[k]] : []) as string[];
  const area = one("obszar");
  const group = one("dla");
  return {
    area: (MWS_AREAS as readonly string[]).includes(area) ? (area as AreaKey) : undefined,
    group: (GROUPS as readonly string[]).includes(group) ? (group as GroupKey) : undefined,
    types: many("typ").filter((t): t is InnovationType => (INNOVATION_TYPES as readonly string[]).includes(t)),
    page: Math.max(1, Math.floor(Number(one("strona"))) || 1),
  };
}

function pageHref(p: LibraryParams, page: number): string {
  const q = new URLSearchParams({ tab: "library" });
  if (p.area) q.set("obszar", p.area);
  if (p.group) q.set("dla", p.group);
  p.types.forEach((t) => q.append("typ", t));
  if (page > 1) q.set("strona", String(page));
  return `/biblioteka?${q}#dzialy`;
}

/** Numery stron do pokazania: pierwsza, ostatnia i sąsiedzi bieżącej; null to przerwa („…”). */
function pageNumbers(current: number, total: number): (number | null)[] {
  const keep = [...new Set([1, current - 1, current, current + 1, total])].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  return keep.flatMap((n, i) => (i > 0 && n - keep[i - 1] > 1 ? [null, n] : [n]));
}

/** „Poprzednia”/„Następna”: na pierwszej i ostatniej stronie zostają na miejscu, ale wyszarzone i nieaktywne. */
function StepLink({ href, className, children }: { href: string | null; className: string; children: React.ReactNode }) {
  if (!href) {
    // <a> bez href nie łapie fokusu ani kliknięć; role + aria-disabled, żeby czytnik ogłosił „link, niedostępny”.
    return <a role="link" aria-disabled="true" className={cn(className, "cursor-not-allowed text-muted-foreground hover:bg-transparent")}>{children}</a>;
  }
  return <Link href={href} scroll={false} className={className}>{children}</Link>;
}

function Pagination({ params: p, current, total }: { params: LibraryParams; current: number; total: number }) {
  const step = "inline-flex min-h-12 items-center gap-1 rounded-full px-4 text-lg hover:bg-secondary";
  return (
    <nav aria-label="Strony listy innowacji">
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <StepLink href={current > 1 ? pageHref(p, current - 1) : null} className={step}>
            <ChevronLeftIcon aria-hidden className="size-5 shrink-0" />
            Poprzednia
          </StepLink>
        </li>
        {pageNumbers(current, total).map((n, i) => (
          <li key={n ?? `przerwa-${i}`}>
            {n === null ? (
              <span aria-hidden className="px-2 text-lg">…</span>
            ) : (
              <Link
                href={pageHref(p, n)}
                scroll={false}
                aria-label={`Strona ${n}`}
                aria-current={n === current ? "page" : undefined}
                className={cn(step, "min-w-12 justify-center px-3", "aria-[current=page]:bg-foreground aria-[current=page]:font-bold aria-[current=page]:text-background")}
              >
                {n}
              </Link>
            )}
          </li>
        ))}
        <li>
          <StepLink href={current < total ? pageHref(p, current + 1) : null} className={step}>
            Następna
            <ChevronRightIcon aria-hidden className="size-5 shrink-0" />
          </StepLink>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Biblioteka innowacji: lista i licznik w role="status". Bez osobnego formularza filtrów — „dla kogo” wybiera się
 * przyciskami „Szukam rozwiązania dla…” nad zakładkami; obszar i rodzaj nadal działają z adresu (?obszar=, ?typ=).
 */
export async function LibraryTab({ params: p }: { params: LibraryParams }) {
  const items = await knowledge.innovations({ area: p.area, group: p.group, types: p.types });
  const n = items.length;
  const pages = Math.max(1, Math.ceil(n / PER_PAGE));
  const current = Math.min(p.page, pages);
  const shown = items.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  // Aktywne filtry z adresu — bez formularza trzeba je pokazać i dać sposób, żeby je wyczyścić.
  const filters = [p.group && GROUP_LABELS[p.group].toLowerCase(), p.area && AREA_LABELS[p.area].toLowerCase(), p.types.length > 0 && p.types.map((t) => TYPE_LABELS[t].toLowerCase()).join(", ")]
    .filter((f): f is string => Boolean(f));

  return (
    <section aria-label="Biblioteka innowacji" className="space-y-8">
      <p role="status" className="text-lg">
        <strong>
          {n === 0 ? "Brak innowacji dla wybranych filtrów." : `Znaleziono ${n} ${plural(n, "innowację", "innowacje", "innowacji")}`}
          {n > 0 && filters.length > 0 && ` · ${filters.join(", ")}`}
          {n > 0 && "."}
          {pages > 1 && ` Strona ${current} z ${pages}.`}
        </strong>
        {filters.length > 0 && (
          <>
            {" "}
            <Link href="/biblioteka?tab=library#dzialy" scroll={false} className="underline decoration-1 underline-offset-4 hover:decoration-2">
              Pokaż wszystkie
            </Link>
          </>
        )}
      </p>
      <div id="lista-innowacji">
        <InnovationList items={shown} />
      </div>
      {pages > 1 && <Pagination params={p} current={current} total={pages} />}
    </section>
  );
}
