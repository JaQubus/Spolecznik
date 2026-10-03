import Link from "next/link";
import { InnovationTiles } from "@/components/knowledge/tiles";
import { knowledge } from "@/lib/knowledge";
import { TYPE_LABELS } from "@/lib/knowledge/labels";
import { INNOVATION_TYPES, type AreaKey, type GroupKey, type InnovationType } from "@/lib/knowledge/types";
import { plural } from "@/lib/pl";
import { GROUPS, MWS_AREAS } from "@/lib/schemas";
import { AREA_LABELS, GROUP_LABELS } from "@/lib/taxonomy";

export type LibraryParams = { area?: AreaKey; group?: GroupKey; types: InnovationType[]; limit: number };

const PAGE = 24;

export function parseLibraryParams(sp: Record<string, string | string[] | undefined>): LibraryParams {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const many = (k: string) => (Array.isArray(sp[k]) ? sp[k] : sp[k] ? [sp[k]] : []) as string[];
  const area = one("obszar");
  const group = one("dla");
  return {
    area: (MWS_AREAS as readonly string[]).includes(area) ? (area as AreaKey) : undefined,
    group: (GROUPS as readonly string[]).includes(group) ? (group as GroupKey) : undefined,
    types: many("typ").filter((t): t is InnovationType => (INNOVATION_TYPES as readonly string[]).includes(t)),
    limit: Math.min(200, Math.max(PAGE, Number(one("ile")) || PAGE)),
  };
}

function moreHref(p: LibraryParams): string {
  const q = new URLSearchParams({ tab: "library" });
  if (p.area) q.set("obszar", p.area);
  if (p.group) q.set("dla", p.group);
  p.types.forEach((t) => q.append("typ", t));
  q.set("ile", String(p.limit + PAGE));
  return `/biblioteka?${q}#lista-innowacji`;
}

/**
 * Biblioteka innowacji: kafle i licznik w role="status". Bez osobnego formularza filtrów — „dla kogo” wybiera się
 * przyciskami „Szukam rozwiązania dla…” nad zakładkami; obszar i rodzaj nadal działają z adresu (?obszar=, ?typ=).
 */
export async function LibraryTab({ params: p }: { params: LibraryParams }) {
  const items = await knowledge.innovations({ area: p.area, group: p.group, types: p.types });
  const shown = items.slice(0, p.limit);
  const n = items.length;
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
        <InnovationTiles items={shown} />
      </div>
      {n > shown.length && (
        <p>
          <Link href={moreHref(p)} scroll={false} className="inline-flex min-h-12 items-center rounded-full border border-foreground px-6 text-lg font-bold hover:bg-secondary">
            Pokaż kolejne ({Math.min(PAGE, n - shown.length)} z {n - shown.length})
          </Link>
        </p>
      )}
    </section>
  );
}
