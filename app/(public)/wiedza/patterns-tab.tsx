import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { cn } from "cn";
import { PatternList } from "@/components/knowledge/tiles";
import { knowledge } from "@/lib/knowledge";
import { TYPE_LABELS } from "@/lib/knowledge/labels";
import { INNOVATION_TYPES, type InnovationType } from "@/lib/knowledge/types";
import { plural } from "@/lib/pl";
import { DOMAIN_KEYS, domainLabel, type DomainKey } from "@/lib/taxonomy";

export type PatternParams = { domain?: DomainKey; types: InnovationType[]; page: number };

const PER_PAGE = 15;

export function parsePatternParams(sp: Record<string, string | string[] | undefined>): PatternParams {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const many = (k: string) => (Array.isArray(sp[k]) ? sp[k] : sp[k] ? [sp[k]] : []) as string[];
  const domain = one("dziedzina");
  return {
    domain: (DOMAIN_KEYS as readonly string[]).includes(domain) ? (domain as DomainKey) : undefined,
    types: many("typ").filter((t): t is InnovationType => (INNOVATION_TYPES as readonly string[]).includes(t)),
    page: Math.max(1, Math.floor(Number(one("strona"))) || 1),
  };
}

function pageHref(p: PatternParams, page: number): string {
  const q = new URLSearchParams({ tab: "rozwiazania" });
  if (p.domain) q.set("dziedzina", p.domain);
  p.types.forEach((t) => q.append("typ", t));
  if (page > 1) q.set("strona", String(page));
  return `/wiedza?${q}#dzialy`;
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

function Pagination({ params: p, current, total }: { params: PatternParams; current: number; total: number }) {
  const step = "inline-flex min-h-12 items-center gap-1 rounded-full px-4 text-lg hover:bg-secondary";
  return (
    <nav aria-label="Strony listy rozwiązań">
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
 * Sprawdzone rozwiązania z Polski (Biblioteka Innowacji Społecznych w Krakowie): lista i licznik w role="status".
 * Dziedzinę wybiera się przyciskami nad zakładkami; dziedzina i rodzaj działają z adresu (?dziedzina=, ?typ=).
 */
export async function PatternsTab({ params: p }: { params: PatternParams }) {
  const items = await knowledge.patterns({ domain: p.domain, types: p.types });
  const n = items.length;
  const pages = Math.max(1, Math.ceil(n / PER_PAGE));
  const current = Math.min(p.page, pages);
  const shown = items.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  // Aktywne filtry z adresu — bez formularza trzeba je pokazać i dać sposób, żeby je wyczyścić.
  const filters = [p.domain && domainLabel(p.domain).toLowerCase(), p.types.length > 0 && p.types.map((t) => TYPE_LABELS[t].toLowerCase()).join(", ")]
    .filter((f): f is string => Boolean(f));

  return (
    <section aria-label="Sprawdzone rozwiązania z Polski" className="space-y-8">
      <p className="max-w-[44rem] text-lg">
        Innowacje społeczne sprawdzone w innych regionach. Opisy pochodzą z Biblioteki Innowacji Społecznych Regionalnego
        Ośrodka Polityki Społecznej w Krakowie — źródło jest przy każdej pozycji.
      </p>
      <p role="status" className="text-lg">
        <strong>
          {n === 0 ? "Brak rozwiązań dla wybranych filtrów." : `Znaleziono ${n} ${plural(n, "rozwiązanie", "rozwiązania", "rozwiązań")}`}
          {n > 0 && filters.length > 0 && ` · ${filters.join(", ")}`}
          {n > 0 && "."}
          {pages > 1 && ` Strona ${current} z ${pages}.`}
        </strong>
        {filters.length > 0 && (
          <>
            {" "}
            <Link href="/wiedza?tab=rozwiazania#dzialy" scroll={false} className="underline decoration-1 underline-offset-4 hover:decoration-2">
              Pokaż wszystkie
            </Link>
          </>
        )}
      </p>
      <div id="lista-rozwiazan">
        <PatternList items={shown} />
      </div>
      {pages > 1 && <Pagination params={p} current={current} total={pages} />}
    </section>
  );
}
