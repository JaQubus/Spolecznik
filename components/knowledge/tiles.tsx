import { StoryTile, StoryTiles } from "@/components/ui/story-tile";
import { TYPE_LABELS } from "@/lib/knowledge/labels";
import type { Area, Innovation } from "@/lib/knowledge/types";
import { GROUP_LABELS } from "@/lib/taxonomy";
import { GROUP_ICONS, AreaIcon } from "./icons";

export const innovationHref = (slug: string) => `/biblioteka/innowacja/${slug}`;
export const areaHref = (slug: string) => `/biblioteka/obszar/${slug}`;

/** Kafle innowacji: miniatura filmu albo ikona kategorii; jeden link na kafel (tytuł). */
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
            image={i.video?.thumbnailUrl ? { src: i.video.thumbnailUrl, alt: "" } : undefined}
            badge={i.video ? "Film" : undefined}
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

/** Kafle obszarów: duża ikona, nazwa i jedno zdanie. */
export function AreaTiles({ areas, className }: { areas: Area[]; className?: string }) {
  return (
    <StoryTiles className={className}>
      {areas.map((a) => (
        <StoryTile
          key={a.key}
          wide
          href={areaHref(a.slug)}
          title={a.name}
          placeholder={<AreaIcon area={a.key} className="size-16" />}
          note={a.lead}
        />
      ))}
    </StoryTiles>
  );
}
