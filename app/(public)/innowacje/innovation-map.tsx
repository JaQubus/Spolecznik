import Link from "next/link";
import { cn } from "cn";
import type { HoverDetail } from "@/components/maps/map-hover";
import type { InnovationFilters } from "@/lib/innovations/filters";
import { filtersHref } from "@/lib/innovations/filters";
import { COUNT_FILLS, COUNT_LEGEND, countClass } from "@/lib/innovations/map";
import { plural } from "@/lib/pl";
import { region } from "@/lib/brand";
import mapJson from "@/public/mapa/region.json";
import type { MapData } from "@/lib/knowledge/map";
import { TerritoryMap, type TerritoryItem } from "../mapa/kondycja/territory-map";

const DATA = mapJson as unknown as MapData;
const POWIATY = DATA.layers.powiaty.units;

/** Plik z granicami musi dotyczyć regionu z config/brand.json — inaczej nie pokazujemy mapy, tylko tabelę. */
const GEOMETRY_MATCHES_REGION = POWIATY.length > 0 && POWIATY.every((u) => u.id.startsWith(region.terytPrefix));

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";
const noun = (n: number) => plural(n, "innowacja", "innowacje", "innowacji");

export type CountyRow = { id: string; name: string; count: number };

/**
 * Mapa innowacji: liczba opublikowanych innowacji w powiecie przy bieżących filtrach (bez filtra powiatu).
 * Kolor nie jest jedyną informacją: każdy powiat jest też wierszem tabeli z liczbą i linkiem, więc klawiatura
 * i czytnik ekranu nie zależą od mapy.
 */
export function InnovationMap({ counties, filters }: { counties: CountyRow[]; filters: InnovationFilters }) {
  const counts = new Map(counties.map((c) => [c.id, c.count]));
  const href = (id: string) => filtersHref(filters, { county: filters.county === id ? undefined : id }, "#lista");

  const items: TerritoryItem[] = POWIATY.map((u) => {
    const n = counts.get(u.id) ?? 0;
    return { id: u.id, name: `${u.name}: ${n} ${noun(n)}. Pokaż innowacje z tego powiatu`, fill: COUNT_FILLS[countClass(n)], href: href(u.id) };
  });
  const details: Record<string, HoverDetail> = Object.fromEntries(POWIATY.map((u) => {
    const n = counts.get(u.id) ?? 0;
    return [u.id, { title: u.name, rows: [{ label: "Innowacje", value: String(n), swatch: COUNT_FILLS[countClass(n)] ?? undefined, current: true }] }];
  }));
  const sorted = [...counties].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pl"));

  return (
    <section aria-labelledby="mapa" className="space-y-6">
      <h2 id="mapa" className="text-3xl font-bold">Mapa innowacji</h2>
      <p className="max-w-[68ch] text-lg">Liczba innowacji w powiatach. Wybierz powiat, żeby zobaczyć tylko jego innowacje.</p>

      {GEOMETRY_MATCHES_REGION && (
        <div className="space-y-3">
          <TerritoryMap data={DATA} layer="powiaty" items={items} selected={filters.county ?? null} title={`Liczba innowacji w powiatach: ${region.genitive}`} details={details} />
          <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Legenda mapy">
            {COUNT_LEGEND.map((l) => (
              <li key={l.c} className="flex items-center gap-2 text-base">
                <span aria-hidden className="size-5 rounded border border-border-strong" style={{ background: COUNT_FILLS[l.c] ?? "var(--surface-sunken)" }} />
                {l.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details open={!GEOMETRY_MATCHES_REGION} className="max-w-3xl">
        <summary className="inline-flex min-h-12 cursor-pointer items-center text-lg font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
          Innowacje według powiatów
        </summary>
        {sorted.length === 0 ? (
          <p className="pt-3 text-muted-foreground">Dla wybranych filtrów nie ma innowacji w żadnym powiecie.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-base">
            <caption className="sr-only">Liczba innowacji w powiatach przy wybranych filtrach</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="p-3 text-left">Powiat</th>
                <th scope="col" className="p-3 text-right">Innowacje</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-b">
                  <th scope="row" className="p-3 text-left font-normal">
                    <Link href={href(c.id)} aria-current={filters.county === c.id ? "true" : undefined} className={cn(linkClass, "inline-flex min-h-12 items-center aria-[current=true]:font-bold")}>
                      {c.name}
                    </Link>
                  </th>
                  <td className="p-3 text-right">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </section>
  );
}
