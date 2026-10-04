import Link from "next/link";
import { StoryTile, StoryTiles } from "@/components/ui/story-tile";
import { TYPE_LABELS } from "@/lib/knowledge/labels";
import type { Area, Innovation } from "@/lib/knowledge/types";
import { GROUP_LABELS } from "@/lib/taxonomy";
import { AreaIcon, GROUP_ICONS } from "./icons";

import { areaHref, innovationHref } from "@/lib/knowledge/hrefs";

export { areaHref, innovationHref };

/** Kafle innowacji: ikona kategorii (bez miniatur filmów); jeden link na kafel (tytuł). */
export function InnovationTiles({ items, className, level }: { items: Innovation[]; className?: string; level?: 3 | 4 }) {
  return (
    <StoryTiles className={className}>
      {items.map((i) => {
        const Icon = GROUP_ICONS[i.groups[0]];
        return (
          <StoryTile
            key={i.id}
            level={level}
            href={innovationHref(i.slug)}
            title={i.title}
            placeholder={Icon && <Icon aria-hidden className="size-16" />}
            meta={i.groups.map((g) => GROUP_LABELS[g]).join(", ")}
            note={[i.innovationType && TYPE_LABELS[i.innovationType], i.dissemination && "Wybrana do upowszechniania"]
              .filter(Boolean).join(" · ")}
          />
        );
      })}
    </StoryTiles>
  );
}

/** Innowacje jako zwykła lista wierszy (ResultList.md), w tym samym rozmiarze co lista obszarów. */
export function InnovationList({ items, level = 3 }: { items: Innovation[]; level?: 3 | 4 }) {
  const H = `h${level}` as const;
  return (
    <ul className="max-w-[48rem] divide-y divide-border border-y border-border">
      {items.map((i) => {
        const Icon = GROUP_ICONS[i.groups[0]];
        const meta = [
          i.groups.map((g) => GROUP_LABELS[g]).join(", "),
          i.innovationType && TYPE_LABELS[i.innovationType],
          i.dissemination && "Wybrana do upowszechniania",
        ].filter(Boolean).join(" · ");
        return (
          <li key={i.id} className="flex items-start gap-4 py-5">
            {Icon && <Icon aria-hidden className="mt-1 size-8 shrink-0" />}
            <div className="space-y-1">
              <H className="text-xl font-bold">
                <Link href={innovationHref(i.slug)} className="underline decoration-1 underline-offset-4 hover:decoration-2">{i.title}</Link>
              </H>
              {meta && <p>{meta}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Obszary (główne tematy) jako lista wierszy: mała ikona, nazwa jako link i jedno zdanie. */
export function AreaList({ areas, level = 3 }: { areas: Area[]; level?: 3 | 4 }) {
  const H = `h${level}` as const;
  return (
    <ul className="max-w-[48rem] divide-y divide-border border-y border-border">
      {areas.map((a) => (
        <li key={a.key} className="flex items-start gap-4 py-5">
          <AreaIcon area={a.key} className="mt-1 size-8 shrink-0" />
          <div className="space-y-1">
            <H className="text-xl font-bold">
              <Link href={areaHref(a.slug)} className="underline decoration-1 underline-offset-4 hover:decoration-2">{a.name}</Link>
            </H>
            <p>{a.lead}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
