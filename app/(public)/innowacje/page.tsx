import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { NoDatabase } from "@/components/layout/no-database";
import { DomainIcon } from "@/components/taxonomy/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { listPublicInitiatives, publicInitiativesAvailable } from "@/lib/initiatives/public";
import { activeFilterCount, filtersHref, parseFilters, SIGNAL_FILTER_LEVELS, signalMinFor } from "@/lib/innovations/filters";
import { countByCounty } from "@/lib/innovations/map";
import { initiativeHref } from "@/lib/knowledge/hrefs";
import { plural } from "@/lib/pl";
import {
  DOMAIN_KEYS, domainLabel, INNOVATION_KIND_KEYS, innovationKindLabel, INSTITUTION_KEYS, institutionLabel, SECTOR_KEYS, sectorLabel,
  signalLevel, STAGE_KEYS, stageLabel, TRL_MAX, TRL_MIN,
} from "@/lib/taxonomy";
import { region } from "@/lib/brand";
import { InnovationMap, type CountyRow } from "./innovation-map";

export const metadata: Metadata = { title: "Innowacje", description: `Innowacje ${region.genitive} po weryfikacji: filtry, mapa i ocena radaru.` };

const trlOptions = Array.from({ length: TRL_MAX - TRL_MIN + 1 }, (_, i) => TRL_MIN + i);
const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

/** Baza opublikowanych innowacji: filtry w adresie (działają bez JavaScriptu), mapa powiatów i lista. */
export default async function Page(props: PageProps<"/innowacje">) {
  if (!publicInitiativesAvailable()) return <NoDatabase />;
  const filters = parseFilters(await props.searchParams);

  // Powiat nie zawęża zapytania: mapa ma pokazywać wszystkie powiaty przy pozostałych filtrach, a listę zawężamy niżej.
  const { county, signal, trlMin, ...rest } = filters;
  const all = await listPublicInitiatives({ ...rest, trlMin, signalMin: signalMinFor(signal) ?? undefined });
  const items = county ? all.filter((i) => i.county_teryt === county) : all;
  const n = items.length;

  const names = new Map<string, string>();
  for (const i of all) if (i.county_teryt && i.county) names.set(i.county_teryt, i.county);
  const counties: CountyRow[] = Object.entries(countByCounty(all)).map(([id, count]) => ({ id, count, name: names.get(id) ?? `powiat ${id}` }));
  const countyName = county ? names.get(county) ?? `powiat ${county}` : null;

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Innowacje {region.locative}</h1>
        <p className="max-w-2xl text-xl">
          Innowacje ze szkół, uczelni, samorządów i instytucji publicznych, które zespół zweryfikował. Każdą można wdrożyć albo sfinansować.
        </p>
        <p>
          <Link href="/szukam-innowacji" className={`inline-flex min-h-12 items-center font-bold ${linkClass}`}>Szukasz innowacji do wdrożenia lub finansowania?</Link>
        </p>
      </header>

      <Form action="/innowacje" aria-label="Filtry innowacji" className="flex flex-col gap-6 rounded-[16px] bg-secondary p-5 md:flex-row md:flex-wrap md:items-end">
        {county && <input type="hidden" name="powiat" value={county} />}
        <div className="flex flex-1 flex-col gap-2 md:min-w-56">
          <Label htmlFor="f-typ">Typ innowacji</Label>
          <NativeSelect id="f-typ" name="typ" defaultValue={filters.kind ?? ""}>
            <option value="">Wszystkie typy</option>
            {INNOVATION_KIND_KEYS.map((k) => <option key={k} value={k}>{innovationKindLabel(k)}</option>)}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-col gap-2 md:min-w-56">
          <Label htmlFor="f-sektor">Sektor PCI</Label>
          <NativeSelect id="f-sektor" name="sektor" defaultValue={filters.sector ?? ""}>
            <option value="">Wszystkie sektory</option>
            {SECTOR_KEYS.map((k) => <option key={k} value={k}>{sectorLabel(k)}</option>)}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-col gap-2 md:min-w-56">
          <Label htmlFor="f-dziedzina">Dziedzina</Label>
          <NativeSelect id="f-dziedzina" name="dziedzina" defaultValue={filters.domain ?? ""}>
            <option value="">Wszystkie dziedziny</option>
            {DOMAIN_KEYS.map((d) => <option key={d} value={d}>{domainLabel(d)}</option>)}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-col gap-2 md:min-w-56">
          <Label htmlFor="f-instytucja">Typ instytucji</Label>
          <NativeSelect id="f-instytucja" name="instytucja" defaultValue={filters.institution ?? ""}>
            <option value="">Wszystkie typy</option>
            {INSTITUTION_KEYS.map((k) => <option key={k} value={k}>{institutionLabel(k)}</option>)}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-col gap-2 md:min-w-56">
          <Label htmlFor="f-etap">Etap</Label>
          <NativeSelect id="f-etap" name="etap" defaultValue={filters.stage ?? ""}>
            <option value="">Wszystkie etapy</option>
            {STAGE_KEYS.map((k) => <option key={k} value={k}>{stageLabel(k)}</option>)}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-col gap-2 md:min-w-56">
          <Label htmlFor="f-trl">Gotowość technologii (TRL)</Label>
          <NativeSelect id="f-trl" name="trl" defaultValue={filters.trlMin != null ? String(filters.trlMin) : ""}>
            <option value="">Dowolna</option>
            {trlOptions.map((t) => <option key={t} value={t}>TRL {t} lub wyższa</option>)}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-col gap-2 md:min-w-56">
          <Label htmlFor="f-sygnal">Sygnał radaru</Label>
          <NativeSelect id="f-sygnal" name="sygnal" defaultValue={filters.signal ?? ""}>
            <option value="">Dowolny</option>
            {SIGNAL_FILTER_LEVELS.map((l) => <option key={l.key} value={l.key}>Co najmniej: {l.label}</option>)}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">Pokaż</Button>
      </Form>

      <InnovationMap counties={counties} filters={filters} />

      <section aria-labelledby="lista" className="space-y-6">
        <h2 id="lista" className="text-3xl font-bold">Lista innowacji</h2>
        <p role="status" className="text-lg font-bold">
          {n === 0 ? "Brak innowacji dla wybranych filtrów." : `Znaleziono ${n} ${plural(n, "innowację", "innowacje", "innowacji")}`}
          {countyName && n > 0 && ` w powiecie: ${countyName}`}
          {n > 0 && "."}
        </p>
        {activeFilterCount(filters) > 0 && (
          <p>
            <Link href="/innowacje#lista" className={`inline-flex min-h-12 items-center ${linkClass}`}>Wyczyść filtry</Link>
            {county && (
              <>{" · "}<Link href={filtersHref(filters, { county: undefined }, "#lista")} className={`inline-flex min-h-12 items-center ${linkClass}`}>Pokaż wszystkie powiaty</Link></>
            )}
          </p>
        )}

        <ul className="max-w-[56rem] divide-y divide-border border-y border-border">
          {items.map((i) => (
            <li key={i.id} className="flex items-start gap-4 py-5">
              {i.domains[0] && <DomainIcon domain={i.domains[0]} className="mt-1 size-10" iconClassName="size-6" />}
              <div className="min-w-0 space-y-1">
                <h3 className="text-xl font-bold">
                  {i.slug
                    ? <Link href={initiativeHref(i.slug)} className={linkClass}>{i.title}</Link>
                    : i.title}
                </h3>
                <p>{i.summary}</p>
                <p className="text-base text-muted-foreground">
                  {[i.innovation_kind && `innowacja ${innovationKindLabel(i.innovation_kind).toLowerCase()}`, i.municipality && `gmina ${i.municipality}`,
                    i.institution_name ?? (i.institution_type && institutionLabel(i.institution_type)), i.stage && stageLabel(i.stage), i.trl != null && `TRL ${i.trl}`]
                    .filter(Boolean).join(" · ")}
                </p>
                <p className="flex flex-wrap gap-2">
                  {i.signal != null && <Badge>Sygnał {i.signal}/100: {signalLevel(i.signal).label}</Badge>}
                  {i.sectors.filter((s) => s !== "inne").map((s) => <Badge key={s} variant="outline">{sectorLabel(s)}</Badge>)}
                  {i.synthetic && <Badge>Przykład demonstracyjny</Badge>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
