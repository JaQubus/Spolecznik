import { CheckIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { cn } from "cn";
import { MAP_CATEGORIES } from "@/components/knowledge/map-categories";
import { innovationsForArea } from "@/lib/innovations";
import { classify, ranked, withUnit, type MapData, type MapIndicator, type MapUnit } from "@/lib/knowledge/map";
import powiatyShapes from "@/lib/powiaty-shapes.json";
import { formatNumber } from "@/lib/pl";
import { AREA_LABELS } from "@/lib/taxonomy";
import mapJson from "@/public/mapa/malopolska.json";
import { LINK as linkClass } from "../shared";
import { ChoroplethMap } from "./choropleth-map";
import { FocusHeading } from "./focus-heading";
import { IndicatorSelect } from "./indicator-select";
import type { HoverDetail } from "./map-hover";

/** Wszystkie wskaźniki powiatów z IOSS (data/knowledge_map.py), pogrupowane w te same kategorie co mapa gmin. */
const LAYER = (mapJson as unknown as MapData).layers.powiaty;
const TOP = 5;
const NO_DATA = "var(--surface-sunken)";
/** Wskaźnik pokazywany, gdy w adresie nie ma żadnego: najbliższy temu, czym zajmuje się ROPS. */
const DEFAULT_INDICATOR = "beneficjenci";

/** Kształty z PRG GUGiK (data/powiaty_geo.py) mają id jak „bochenski”, „nowysacz”. */
const POWIAT_SHAPES = { ...powiatyShapes, shapes: powiatyShapes.shapes.map((s) => ({ ...s, id: s.powiat })) };

/** „powiat dąbrowski” → „dabrowski”, „Nowy Sącz (miasto na prawach powiatu)” → „nowysacz” — id kształtu z nazwy jednostki. */
const slug = (u: MapUnit) =>
  shortName(u).normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l").replace(/\s+/g, "").toLowerCase();
/** „powiat bocheński” → „bocheński”, „Kraków (miasto na prawach powiatu)” → „Kraków”. */
const shortName = (u: MapUnit) => u.name.replace(/^powiat\s+/, "").replace(/\s*\(miasto na prawach powiatu\)$/, "");

export const powiatyHref = (indicator: string, powiat?: string) =>
  `/biblioteka/kondycja?poziom=powiaty&wskaznik=${indicator}${powiat ? `&powiat=${powiat}#karta` : ""}`;

const chipClass =
  "inline-flex min-h-12 max-w-full items-center gap-2 rounded-full border border-border-strong bg-background px-4 py-2 text-base [overflow-wrap:anywhere] hover:border-foreground aria-[current=true]:border-foreground aria-[current=true]:bg-foreground aria-[current=true]:font-bold aria-[current=true]:text-background";

/** Wartość słowami; przy skali rozbieżnej (np. przyrost naturalny) ze znakiem plus. */
const show = (v: number | null | undefined, ind: MapIndicator) =>
  v == null ? "brak danych" : `${ind.scale === "diverging" && v > 0 ? "+" : ""}${withUnit(v, ind)}`;

/** Miejsce jednostki w rankingu wskaźnika (1 = najwyższa wartość) albo null przy braku danych. */
const placeOf = (key: string, id: string) => {
  const i = ranked(LAYER.units, key).findIndex((u) => u.id === id);
  return i < 0 ? null : i + 1;
};

/**
 * Kondycja Małopolski: 22 powiaty. Kategoria (jak na mapie gmin) i „Co pokazać” wybierają jeden z ponad 100
 * wskaźników IOSS; mapa, pierwsza piątka i tabela pokazują te same liczby. Kliknięcie powiatu otwiera jego kartę.
 */
export async function PowiatyView({ requested, selectedId }: { requested?: string; selectedId?: string }) {
  const indicator =
    LAYER.indicators.find((i) => i.key === requested) ??
    LAYER.indicators.find((i) => i.key === DEFAULT_INDICATOR) ??
    LAYER.indicators[0];
  const order = ranked(LAYER.units, indicator.key);
  const classes = order.length ? classify(order.map((u) => u.values[indicator.key] as number), indicator) : [];
  const rows = [...LAYER.units]
    .map((u) => {
      const value = u.values[indicator.key];
      const place = order.indexOf(u);
      return {
        u,
        id: slug(u),
        value,
        place: place < 0 ? null : place + 1,
        fill: value == null ? null : classes.find((c) => c.test(value))?.fill ?? null,
      };
    })
    .sort((a, b) => shortName(a.u).localeCompare(shortName(b.u), "pl"));
  const top = rows.filter((r) => r.place != null).sort((a, b) => a.place! - b.place!).slice(0, TOP);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const categories = MAP_CATEGORIES.filter((c) => LAYER.indicators.some((i) => i.category === c.key));
  const category = categories.find((c) => c.key === indicator.category);
  const inCategory = LAYER.indicators.filter((i) => i.category === indicator.category);
  const population = LAYER.indicators.find((i) => i.key === "ludnosc");

  const details: Record<string, HoverDetail> = Object.fromEntries(rows.map((r) => [r.id, {
    title: shortName(r.u),
    subtitle: r.u.name.startsWith("powiat ") ? "powiat ziemski" : "miasto na prawach powiatu",
    rows: [
      { label: indicator.label, value: show(r.value, indicator), current: true, swatch: r.fill ?? NO_DATA },
      ...(r.place != null ? [{ label: "Miejsce", value: `${r.place}. na ${order.length}` }] : []),
      ...(population && indicator !== population && r.u.values.ludnosc != null
        ? [{ label: "Mieszkańcy", value: formatNumber(r.u.values.ludnosc, 0) }]
        : []),
    ],
  }]));

  return (
    <>
      <div className="space-y-6">
        <nav aria-labelledby="kategorie-powiatow" className="space-y-3">
          <h2 id="kategorie-powiatow" className="text-lg font-bold">Kategoria</h2>
          <ul className="flex flex-wrap gap-2">
            {categories.map(({ key, label, Icon }) => {
              const current = key === indicator.category;
              const first = LAYER.indicators.find((i) => i.category === key)!;
              const count = LAYER.indicators.filter((i) => i.category === key).length;
              return (
                <li key={key} className="max-w-full">
                  <Link href={powiatyHref(first.key, selected?.id)} scroll={false} aria-current={current} className={chipClass}>
                    {current ? <CheckIcon aria-hidden className="size-5" /> : <Icon aria-hidden className="size-5" />}
                    {label} ({count})
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <IndicatorSelect key={indicator.key} options={inCategory} value={indicator.key} powiat={selected?.id ?? null} />
      </div>

      <section aria-labelledby="wskaznik-powiatow" className="space-y-6">
        <div className="space-y-2">
          {category && <p className="text-base font-bold text-muted-foreground">{category.label}</p>}
          <h2 id="wskaznik-powiatow" className="text-3xl font-bold break-words hyphens-auto">{indicator.label}</h2>
          <p role="status" className="max-w-2xl text-lg">{indicator.question} Dane za {indicator.source.year} rok.</p>
          {indicator.area && (
            <p>
              <Link href={`/biblioteka/obszar/${indicator.area.replace(/_/g, "-")}`} className={linkClass}>
                Zobacz rozwiązania: {AREA_LABELS[indicator.area]}
              </Link>
            </p>
          )}
        </div>

        <figure className="space-y-4">
          <a href="#tabela-powiatow" className={cn(linkClass, "sr-only focus:not-sr-only")}>Pomiń mapę i przejdź do tabeli</a>
          <ChoroplethMap
            shapes={POWIAT_SHAPES}
            title={`Mapa powiatów: ${indicator.label}`}
            selected={selected?.id ?? null}
            details={details}
            items={rows.map((r) => ({
              id: r.id,
              name: `${r.u.name}: ${show(r.value, indicator)}. Pokaż kartę powiatu`,
              cls: null,
              fill: r.fill,
              href: powiatyHref(indicator.key, r.id),
            }))}
          />
          <figcaption className="max-w-2xl space-y-3">
            <ul aria-label="Legenda mapy" className="flex flex-wrap gap-x-5 gap-y-2 text-base">
              {classes.map((c) => (
                <li key={c.label} className="inline-flex items-center gap-2">
                  <span aria-hidden className="size-5 shrink-0 rounded-[4px] border border-border-strong" style={{ background: c.fill }} />
                  {c.label}
                </li>
              ))}
              {rows.some((r) => r.value == null) && (
                <li className="inline-flex items-center gap-2">
                  <span aria-hidden className="size-5 shrink-0 rounded-[4px] border border-border-strong" style={{ background: NO_DATA }} />
                  brak danych
                </li>
              )}
            </ul>
            <p className="text-base text-muted-foreground">
              {indicator.scale === "diverging"
                ? "Niebieski to wartości poniżej zera, czerwony — od zera w górę. Im ciemniej, tym dalej od zera."
                : "Im ciemniejszy kolor, tym wyższa wartość."}{" "}
              Te same liczby są w tabelach poniżej.
            </p>
          </figcaption>
        </figure>

        <div className="space-y-3">
          <h3 id="top-powiatow" className="text-2xl font-bold">{TOP} powiatów z najwyższą wartością</h3>
          <div role="region" aria-labelledby="top-powiatow" tabIndex={0} className="max-w-2xl overflow-x-auto rounded-lg">
            <table className="w-full border-collapse text-left text-base">
              <caption className="sr-only">{indicator.label}: {TOP} powiatów z najwyższą wartością</caption>
              <thead>
                <tr className="border-b-2 border-foreground align-bottom">
                  <th scope="col" className="py-2 pr-4">Miejsce</th>
                  <th scope="col" className="py-2 pr-4">Powiat</th>
                  <th scope="col" className="py-2 text-right">Wartość</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.id} className={cn("border-b", r.id === selected?.id && "bg-secondary")}>
                    <td className="py-3 pr-4 font-bold tabular-nums">{r.place}.</td>
                    <th scope="row" className="py-3 pr-4 font-normal">
                      <Link href={powiatyHref(indicator.key, r.id)} className={linkClass}>{r.u.name}</Link>
                    </th>
                    <td className="py-3 text-right font-bold whitespace-nowrap tabular-nums">{show(r.value, indicator)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selected && <PowiatCard unit={selected.u} indicator={indicator} inCategory={inCategory} key={selected.id} />}

        <div id="tabela-powiatow" tabIndex={-1} className="scroll-mt-4 space-y-3 outline-none">
          <h3 className="text-2xl font-bold">Dane w tabeli</h3>
          <div role="region" aria-labelledby="tabela-powiatow-podpis" tabIndex={0} className="max-w-2xl overflow-x-auto rounded-lg">
            <table className="w-full border-collapse text-left text-base">
              <caption id="tabela-powiatow-podpis" className="pb-2 text-left text-muted-foreground">
                {indicator.label}: {rows.length} powiatów, {indicator.source.year} r. Źródło:{" "}
                <a href={indicator.source.url} className="underline decoration-1 underline-offset-4">{indicator.source.title}</a>.
              </caption>
              <thead>
                <tr className="border-b-2 border-foreground align-bottom">
                  <th scope="col" className="py-2 pr-4">Powiat</th>
                  <th scope="col" className="py-2 pr-4 text-right">Wartość</th>
                  <th scope="col" className="py-2 text-right">Miejsce (1 = najwyższa wartość)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={cn("border-b", r.id === selected?.id && "bg-secondary")}>
                    <th scope="row" className="py-3 pr-4 font-normal">
                      <Link href={powiatyHref(indicator.key, r.id)} className={linkClass} aria-current={r.id === selected?.id || undefined}>
                        {shortName(r.u)}
                      </Link>
                    </th>
                    <td className="py-3 pr-4 text-right whitespace-nowrap tabular-nums">{show(r.value, indicator)}</td>
                    <td className="py-3 text-right tabular-nums">{r.place ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

/** Karta powiatu: wszystkie wskaźniki wybranej kategorii z miejscem w rankingu + rozwiązania dla obszaru wskaźnika. */
async function PowiatCard({ unit, indicator, inCategory }: { unit: MapUnit; indicator: MapIndicator; inCategory: MapIndicator[] }) {
  const innovations = indicator.area ? await innovationsForArea(indicator.area, []) : [];
  const category = MAP_CATEGORIES.find((c) => c.key === indicator.category);
  const population = unit.values.ludnosc;

  return (
    <section id="karta" aria-labelledby="karta-tytul" className="scroll-mt-4 space-y-6 rounded-[16px] bg-secondary px-5 py-6 md:px-8">
      <div className="space-y-1">
        <FocusHeading id="karta-tytul" className="text-2xl font-bold outline-none">{unit.name}</FocusHeading>
        {population != null && <p className="text-lg">Mieszka tu {formatNumber(population, 0)} osób.</p>}
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-bold">{category?.label ?? "Wskaźniki"}</h3>
        <dl className="grid max-w-3xl gap-x-6 sm:grid-cols-[minmax(0,1fr)_auto]">
          {inCategory.map((i) => {
            const place = placeOf(i.key, unit.id);
            return (
              <div key={i.key} className="contents">
                <dt className={cn("pt-3 sm:border-t sm:border-border-strong/40", i.key === indicator.key && "font-bold")}>{i.label}</dt>
                <dd className="pb-3 sm:border-t sm:border-border-strong/40 sm:pt-3 sm:text-right">
                  <strong className="tabular-nums">{show(unit.values[i.key], i)}</strong>
                  {place != null && <span className="block text-base text-muted-foreground">{place}. miejsce na {ranked(LAYER.units, i.key).length}</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      {indicator.area && (
        <div className="space-y-3">
          <h3 className="text-xl font-bold">Rozwiązania z Biblioteki: {AREA_LABELS[indicator.area].toLowerCase()}</h3>
          {innovations.length ? (
            <ul className="max-w-3xl space-y-2">
              {innovations.map((i) => (
                <li key={i.id}>
                  <Link href={`/biblioteka/${i.slug ?? i.id}`} className={linkClass}>{i.title}</Link>
                  {i.solution && <p className="line-clamp-2 text-base text-muted-foreground">{i.solution}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p>W Bibliotece nie ma jeszcze rozwiązań dla tego tematu.</p>
          )}
        </div>
      )}
    </section>
  );
}
