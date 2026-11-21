import Link from "next/link";
import { StoryTile, StoryTiles } from "@/components/ui/story-tile";
import { DomainIcon } from "@/components/taxonomy/icons";
import { domainHref, patternHref } from "@/lib/knowledge/hrefs";
import { TYPE_LABELS } from "@/lib/knowledge/labels";
import type { Domain, Pattern } from "@/lib/knowledge/types";
import { domainLabel } from "@/lib/taxonomy";

export { domainHref, patternHref };

const patternMeta = (p: Pattern) =>
  [p.innovationType && TYPE_LABELS[p.innovationType], p.dissemination && "Wybrana do upowszechniania"].filter(Boolean).join(" · ");

/** Kafle rozwiązań: ikona dziedziny (bez miniatur filmów); jeden link na kafel (tytuł). */
export function PatternTiles({ items, className, level }: { items: Pattern[]; className?: string; level?: 3 | 4 }) {
  return (
    <StoryTiles className={className}>
      {items.map((p) => {
        const domain = p.domains[0];
        return (
          <StoryTile
            key={p.id}
            level={level}
            href={patternHref(p.slug)}
            title={p.title}
            placeholder={domain && (
              <div data-domain={domain} className="flex size-full items-center justify-center bg-domain-soft">
                <DomainIcon domain={domain} className="size-24" iconClassName="size-14" />
              </div>
            )}
            meta={p.domains.map(domainLabel).join(", ")}
            note={patternMeta(p)}
          />
        );
      })}
    </StoryTiles>
  );
}

/** Rozwiązania jako zwykła lista wierszy (ResultList.md), w tym samym rozmiarze co lista dziedzin. */
export function PatternList({ items, level = 3 }: { items: Pattern[]; level?: 3 | 4 }) {
  const H = `h${level}` as const;
  return (
    <ul className="max-w-[48rem] divide-y divide-border border-y border-border">
      {items.map((p) => {
        const meta = [p.domains.map(domainLabel).join(", "), patternMeta(p)].filter(Boolean).join(" · ");
        return (
          <li key={p.id} className="flex items-start gap-4 py-5">
            {p.domains[0] && <DomainIcon domain={p.domains[0]} className="mt-1 size-10" iconClassName="size-6" />}
            <div className="space-y-1">
              <H className="text-xl font-bold">
                <Link href={patternHref(p.slug)} className="underline decoration-1 underline-offset-4 hover:decoration-2">{p.title}</Link>
              </H>
              {meta && <p>{meta}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Dziedziny jako lista wierszy: mała ikona, nazwa jako link i jedno zdanie. */
export function DomainList({ domains, level = 3 }: { domains: Domain[]; level?: 3 | 4 }) {
  const H = `h${level}` as const;
  return (
    <ul className="max-w-[48rem] divide-y divide-border border-y border-border">
      {domains.map((d) => (
        <li key={d.key} className="flex items-start gap-4 py-5">
          <DomainIcon domain={d.key} className="size-12" iconClassName="size-7" />
          <div className="space-y-1">
            <H className="text-xl font-bold">
              <Link href={domainHref(d.slug)} className="underline decoration-1 underline-offset-4 hover:decoration-2">{d.name}</Link>
            </H>
            <p>{d.lead}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
