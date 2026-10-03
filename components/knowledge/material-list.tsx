import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { formatBytes, isHugeFile, MATERIAL_KIND_LABELS, materialLinkText } from "@/lib/knowledge/labels";
import type { Material } from "@/lib/knowledge/types";
import { MATERIAL_ICONS } from "./icons";

/** Materiały jako lista wierszy (ResultList.md): typ z ikoną i tekstem, tytuł, opis, opisowy link. */
export function MaterialList({ items, headingLevel = 3 }: { items: Material[]; headingLevel?: 2 | 3 | 4 }) {
  if (!items.length) return <p>Brak materiałów spełniających wybrane warunki.</p>;
  const H = `h${headingLevel}` as const;
  return (
    <ul className="max-w-[48rem] divide-y divide-border border-y border-border">
      {items.map((m) => {
        const Icon = MATERIAL_ICONS[m.kind];
        return (
          <li key={m.id} className="space-y-2 py-6">
            <p className="flex items-center gap-2 text-base text-muted-foreground">
              <Icon aria-hidden className="size-5" />
              {MATERIAL_KIND_LABELS[m.kind]}{m.year && ` · ${m.year}`}
            </p>
            <H className="text-xl font-bold">{m.title}</H>
            {m.description && <p>{m.description}</p>}
            <p>
              <a href={m.url} className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
                {materialLinkText(m)}
              </a>
            </p>
            {isHugeFile(m.sizeBytes) && (
              <p className="flex items-start gap-2 text-base">
                <ExclamationTriangleIcon aria-hidden className="mt-1 size-5 shrink-0" />
                Duży plik ({formatBytes(m.sizeBytes)}). Pobieraj przez Wi-Fi.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
