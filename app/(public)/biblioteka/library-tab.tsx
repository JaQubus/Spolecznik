import Form from "next/form";
import Link from "next/link";
import { InnovationTiles } from "@/components/knowledge/tiles";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
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

/** Biblioteka innowacji: filtry jako zwykłe pola formularza, licznik wyników w role="status". */
export async function LibraryTab({ params: p }: { params: LibraryParams }) {
  const items = await knowledge.innovations({ area: p.area, group: p.group, types: p.types });
  const shown = items.slice(0, p.limit);
  const n = items.length;

  return (
    <section aria-labelledby="biblioteka-naglowek" className="space-y-8">
      <h2 id="biblioteka-naglowek" className="text-3xl font-bold">Biblioteka innowacji</h2>
      <p className="max-w-[44rem] text-lg">
        Rozwiązania sprawdzone w Małopolsce w projektach ROPS. Każde ma opis, wyniki testu i materiały do pobrania za darmo.
      </p>

      <Form action="/biblioteka" scroll={false} className="space-y-6 rounded-[16px] bg-secondary p-5">
        <input type="hidden" name="tab" value="library" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="filtr-obszar">Obszar</Label>
            <NativeSelect id="filtr-obszar" name="obszar" defaultValue={p.area ?? ""}>
              <option value="">Wszystkie obszary</option>
              {MWS_AREAS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="filtr-dla">Dla kogo</Label>
            <NativeSelect id="filtr-dla" name="dla" defaultValue={p.group ?? ""}>
              <option value="">Dla wszystkich</option>
              {GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
            </NativeSelect>
          </div>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-lg font-bold">Rodzaj rozwiązania</legend>
          <div className="flex flex-wrap gap-x-8">
            {INNOVATION_TYPES.map((t) => (
              <CheckboxField key={t} name="typ" value={t} label={TYPE_LABELS[t]} defaultChecked={p.types.includes(t)} />
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="outline">Pokaż wyniki</Button>
          <Link href="/biblioteka?tab=library#dzialy" scroll={false} className="inline-flex min-h-12 items-center underline decoration-1 underline-offset-4 hover:decoration-2">
            Wyczyść filtry
          </Link>
        </div>
      </Form>

      <p role="status" className="text-lg font-bold">
        {n === 0 ? "Brak innowacji dla wybranych filtrów." : `Znaleziono ${n} ${plural(n, "innowację", "innowacje", "innowacji")}.`}
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
