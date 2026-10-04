import { CheckIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { innovationHref } from "@/lib/knowledge/hrefs";
import { cn } from "cn";
import { MAP_CATEGORIES } from "@/components/knowledge/map-categories";
import { Alert } from "@/components/ui/alert";
import { innovationsForArea } from "@/lib/innovations";
import { classify, ranked, withUnit, type LayerKey, type MapData, type MapIndicator, type MapUnit } from "@/lib/knowledge/map";
import { formatNumber, plural } from "@/lib/pl";
import { AREA_LABELS } from "@/lib/taxonomy";
import mapJson from "@/public/mapa/malopolska.json";
import { LINK as linkClass } from "../shared";
import { FocusHeading } from "@/components/a11y/focus-heading";
import { IndicatorSelect } from "./indicator-select";
import type { HoverDetail } from "@/components/maps/map-hover";
import { NO_DATA_FILL, TerritoryMap } from "./territory-map";
import { UnitPicker } from "./unit-picker";

/**
 * Granice i wskaźniki obu poziomów (data/knowledge_map.py): gminy z BDL GUS (bdl.py + bdl_wskazniki.py),
 * powiaty z IOSS ROPS. Kategorie i opisy wskaźników: data/map_indicators.py.
 */
const DATA = mapJson as unknown as MapData;
const LAYERS: LayerKey[] = ["gminy", "powiaty"];
const TOP = 5;
/** Wskaźnik pokazywany, gdy w adresie nie ma żadnego: najbliższy temu, czym zajmuje się ROPS. */
const DEFAULT_INDICATOR = "beneficjenci";
const WORDS = {
  gminy: { gen: "gmin", card: "gminy", only: "tylko gminy" },
  powiaty: { gen: "powiatów", card: "powiatu", only: "tylko powiaty" },
} as const;

const otherLayer = (l: LayerKey): LayerKey => (l === "gminy" ? "powiaty" : "gminy");

export const kondycjaHref = (layer: LayerKey, indicator: string, id?: string | null) =>
  `/biblioteka/kondycja?poziom=${layer}&wskaznik=${indicator}${id ? `&id=${id}#karta` : ""}`;

/** Wybrana jednostka po przełączeniu poziomu: gmina → jej powiat (pierwsze 4 cyfry TERYT); z powiatu do gmin wybór znika. */
const carryId = (to: LayerKey, id: string | undefined) => (to === "powiaty" && id ? id.slice(0, 4) : null);

const chipClass =
  "inline-flex min-h-12 max-w-full items-center gap-2 rounded-full border border-border-strong bg-background px-4 py-2 text-base [overflow-wrap:anywhere] hover:border-foreground aria-[current=true]:border-foreground aria-[current=true]:bg-foreground aria-[current=true]:font-bold aria-[current=true]:text-background";

/**
 * Miejsce w rankingu z remisami: p = 1 + liczba jednostek z większą wartością (1 = najwyższa), low — to samo od dołu,
 * ties — ile jednostek ma tę samą wartość. Bez remisów 15 powiatów z zerem placówek dostałoby miejsca 8–22 według alfabetu.
 */
type Place = { p: number; low: number; ties: number; of: number };
const rankCache = new Map<string, Map<string, Place>>();
function places(layer: LayerKey, key: string) {
  const k = `${layer}:${key}`;
  let m = rankCache.get(k);
  if (!m) {
    const list = ranked(DATA.layers[layer].units, key);
    const vs = list.map((u) => u.values[key] as number);
    m = new Map(list.map((u, i) => {
      const v = vs[i];
      const p = vs.indexOf(v) + 1;
      const ties = vs.lastIndexOf(v) - vs.indexOf(v) + 1;
      return [u.id, { p, low: vs.length - vs.lastIndexOf(v), ties, of: vs.length }];
    }));
    rankCache.set(k, m);
  }
  return m;
}

/** „3. miejsce na 22”, z dopiskiem przy skrajnych wartościach. */
const placeText = ({ p, low, of }: Place) =>
  `${p}. miejsce na ${of}${p === 1 ? " (najwyższa wartość)" : low === 1 ? " (najniższa wartość)" : ""}`;

/**
 * Wartość z jednostką; przy skali rozbieżnej (np. przyrost naturalny) ze znakiem plus.
 * Liczba i skrót po niej („10 tys.”) zostają w jednym wierszu, gdy wąska kolumna tabeli zawija jednostkę.
 */
const show = (v: number | null | undefined, ind: MapIndicator) =>
  v == null
    ? "brak danych"
    : `${ind.scale === "diverging" && v > 0 ? "+" : ""}${withUnit(v, ind)}`.replace(/(\d) (?=\p{L}+\.)/gu, "$1 ");

const CITY = / \(miasto na prawach powiatu\)$/;
function subtitle(layer: LayerKey, u: MapUnit) {
  if (layer === "powiaty") return u.name.startsWith("powiat ") ? "powiat ziemski" : "miasto na prawach powiatu";
  if (u.parent && CITY.test(u.parent)) return "miasto na prawach powiatu";
  return `gmina ${u.kind ?? ""}, ${u.parent ?? ""}`;
}

/**
 * Wskaźnik z adresu. Gdy jest tylko na drugim poziomie (np. „Placówki i kadra” są tylko dla powiatów),
 * pokazujemy pierwszy wskaźnik tej samej kategorii albo domyślny — i mówimy o tym w komunikacie.
 */
function resolve(layer: LayerKey, key: string | undefined) {
  const own = DATA.layers[layer].indicators;
  const found = own.find((i) => i.key === key);
  if (found) return { indicator: found, onlyOther: null };
  const elsewhere = DATA.layers[otherLayer(layer)].indicators.find((i) => i.key === key) ?? null;
  const indicator =
    (elsewhere && own.find((i) => i.category === elsewhere.category)) ??
    own.find((i) => i.key === DEFAULT_INDICATOR) ??
    own[0];
  return { indicator, onlyOther: elsewhere };
}

/**
 * Kondycja Małopolski: przełącznik gminy / powiaty, kategorie wskaźników (te same na obu poziomach),
 * mapa, pierwsza piątka i karta terytorium po kliknięciu.
 */
export async function KondycjaView({ layer, requested, selectedId }: { layer: LayerKey; requested?: string; selectedId?: string }) {
  const L = DATA.layers[layer];
  const other = otherLayer(layer);
  const words = WORDS[layer];
  const { indicator, onlyOther } = resolve(layer, requested);
  const order = ranked(L.units, indicator.key);
  const classes = order.length ? classify(order.map((u) => u.values[indicator.key] as number), indicator) : [];
  const fillOf = (u: MapUnit) => {
    const v = u.values[indicator.key];
    return v == null ? null : classes.find((c) => c.test(v))?.fill ?? null;
  };
  const rank = places(layer, indicator.key);
  const selected = L.units.find((u) => u.id === selectedId) ?? null;
  const missing = L.units.filter((u) => u.values[indicator.key] == null);

  const categories = MAP_CATEGORIES
    .map((c) => ({
      ...c,
      here: L.indicators.filter((i) => i.category === c.key),
      there: DATA.layers[other].indicators.filter((i) => i.category === c.key),
    }))
    .filter((c) => c.here.length || c.there.length);
  const category = categories.find((c) => c.key === indicator.category);
  const inCategory = L.indicators.filter((i) => i.category === indicator.category);

  const details: Record<string, HoverDetail> = Object.fromEntries(L.units.map((u) => [u.id, {
    title: u.name,
    subtitle: subtitle(layer, u),
    rows: [
      { label: indicator.label, value: show(u.values[indicator.key], indicator), current: true, swatch: fillOf(u) ?? NO_DATA_FILL },
      ...(rank.has(u.id) ? [{ label: "Miejsce", value: `${rank.get(u.id)!.p}. na ${order.length}` }] : []),
      ...(indicator.key !== "ludnosc" && u.values.ludnosc != null ? [{ label: "Mieszkańcy", value: formatNumber(u.values.ludnosc, 0) }] : []),
    ],
  }]));

  return (
    <>
      <div className="space-y-6">
        <nav aria-labelledby="kondycja-poziom" className="space-y-3">
          <h2 id="kondycja-poziom" className="text-lg font-bold">Pokaż</h2>
          <ul className="flex flex-wrap gap-2">
            {LAYERS.map((k) => {
              const current = k === layer;
              const l = DATA.layers[k];
              return (
                <li key={k} className="max-w-full">
                  <Link
                    href={current ? kondycjaHref(k, indicator.key, selected?.id) : kondycjaHref(k, indicator.key, carryId(k, selected?.id))}
                    scroll={false}
                    aria-current={current}
                    className={chipClass}
                  >
                    {current && <CheckIcon aria-hidden className="size-5" />}
                    {l.label} ({l.units.length})
                    <span className="font-normal">· {l.indicators.length} wskaźników</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <nav aria-labelledby="kondycja-kategorie" className="space-y-3">
          <h2 id="kondycja-kategorie" className="text-lg font-bold">Kategoria</h2>
          <ul className="flex flex-wrap gap-2">
            {categories.map(({ key, label, Icon, here, there }) => {
              const current = key === indicator.category;
              // Kategoria bez danych na tym poziomie prowadzi na drugi poziom — i mówi o tym w nazwie.
              const href = here.length
                ? kondycjaHref(layer, here[0].key, selected?.id)
                : kondycjaHref(other, there[0].key, carryId(other, selected?.id));
              return (
                <li key={key} className="max-w-full">
                  <Link href={href} scroll={false} aria-current={current} className={chipClass}>
                    {current ? <CheckIcon aria-hidden className="size-5" /> : <Icon aria-hidden className="size-5" />}
                    {label} {here.length ? `(${here.length})` : <span className="font-normal">({WORDS[other].only})</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Etykieta, podpowiedź i pole w tych samych wierszach siatki — oba pola zawsze na jednej wysokości. */}
        <div className="grid max-w-4xl gap-x-6 gap-y-6 md:grid-cols-2 md:grid-rows-[auto_auto_auto] md:gap-y-2">
          <IndicatorSelect
            key={indicator.key}
            options={inCategory}
            value={indicator.key}
            hint={`${inCategory.length} ${plural(inCategory.length, "wskaźnik", "wskaźniki", "wskaźników")} w kategorii „${category?.label ?? ""}”.`}
            query={{ poziom: layer, ...(selected ? { id: selected.id } : {}) }}
          />
          <UnitPicker
            layer={layer}
            units={L.units.map(({ id, name, parent, kind }) => ({ id, name, parent, kind }))}
            selected={selected?.id ?? null}
            query={{ poziom: layer, wskaznik: indicator.key }}
          />
        </div>
      </div>

      <section aria-labelledby="kondycja-wskaznik" className="space-y-6">
        {onlyOther && (
          <Alert title={`Tego wskaźnika nie ma dla ${words.gen}`}>
            <p>
              „{onlyOther.label}” jest tylko dla {WORDS[other].gen}.{" "}
              {onlyOther.category === indicator.category
                ? `Pokazujemy wskaźnik z tej samej kategorii, który jest dla ${words.gen}.`
                : `Ta kategoria nie ma danych dla ${words.gen}, więc pokazujemy inny wskaźnik.`}
            </p>
            <p>
              <Link href={kondycjaHref(other, onlyOther.key, carryId(other, selected?.id))} scroll={false} className={linkClass}>
                Pokaż „{onlyOther.label}” dla {WORDS[other].gen}
              </Link>
            </p>
          </Alert>
        )}
        <div className="space-y-2">
          {category && <p className="text-base font-bold text-muted-foreground">{category.label}</p>}
          <h2 id="kondycja-wskaznik" className="text-3xl font-bold break-words hyphens-auto">{indicator.label}</h2>
          <p role="status" className="max-w-2xl text-lg">
            {indicator.question} Dane za {indicator.source.year} rok, {L.units.length} {words.gen}.
          </p>
          {indicator.area && (
            <p>
              <Link href={`/biblioteka/obszar/${indicator.area.replace(/_/g, "-")}`} className={`inline-flex min-h-12 items-center ${linkClass}`}>
                Zobacz rozwiązania: {AREA_LABELS[indicator.area]}
              </Link>
            </p>
          )}
        </div>

        <figure className="space-y-4">
          <a href="#kondycja-top" className={cn(linkClass, "sr-only focus:not-sr-only")}>Pomiń mapę</a>
          <TerritoryMap
            data={DATA}
            layer={layer}
            title={`Mapa ${words.gen}: ${indicator.label}`}
            selected={selected?.id ?? null}
            details={details}
            items={L.units.map((u) => ({
              id: u.id,
              name: `${u.name}${layer === "gminy" ? ` (${subtitle(layer, u)})` : ""}: ${show(u.values[indicator.key], indicator)}. Pokaż kartę ${words.card}`,
              fill: fillOf(u),
              href: kondycjaHref(layer, indicator.key, u.id),
            }))}
          />
          <figcaption className="max-w-3xl space-y-3">
            <ul aria-label="Legenda mapy" className="flex flex-wrap gap-x-5 gap-y-2 text-base">
              {classes.map((c) => (
                <li key={c.label} className="inline-flex items-center gap-2">
                  <span aria-hidden className="size-5 shrink-0 rounded-[4px] border border-border-strong" style={{ background: c.fill }} />
                  {c.label}
                </li>
              ))}
              {missing.length > 0 && (
                <li className="inline-flex items-center gap-2">
                  <span aria-hidden className="size-5 shrink-0 rounded-[4px] border border-border-strong" style={{ background: NO_DATA_FILL }} />
                  brak danych{missing.length <= 3 && ` (${missing.map((u) => u.name).join(", ")})`}
                </li>
              )}
            </ul>
            <p className="text-base text-muted-foreground">
              {indicator.scale === "diverging"
                ? "Niebieski to wartości poniżej zera, czerwony — od zera w górę. Im ciemniej, tym dalej od zera."
                : "Im ciemniejszy kolor, tym wyższa wartość."}{" "}
              Źródło: <a href={indicator.source.url} className="underline decoration-1 underline-offset-4">{indicator.source.title}</a>.
            </p>
          </figcaption>
        </figure>

        <div className="grid gap-8 lg:grid-cols-2">
          {[
            { id: "kondycja-top", title: `${TOP} ${words.gen} z najwyższą wartością`, units: order.slice(0, TOP) },
            { id: "kondycja-dol", title: `${TOP} ${words.gen} z najniższą wartością`, units: order.slice(-TOP).reverse() },
          ].map((list) => (
            <div key={list.id} className="min-w-0 space-y-3">
              <h3 id={list.id} tabIndex={-1} className="text-2xl font-bold outline-none">{list.title}</h3>
              <div role="region" aria-labelledby={list.id} tabIndex={0} className="overflow-x-auto rounded-lg">
                <table className="w-full border-collapse text-left text-base">
                  <caption className="sr-only">{indicator.label}: {list.title}</caption>
                  <thead>
                    <tr className="border-b-2 border-foreground align-bottom">
                      <th scope="col" className="py-2 pr-3">Miejsce</th>
                      <th scope="col" className="py-2 pr-3">{layer === "gminy" ? "Gmina" : "Powiat"}</th>
                      <th scope="col" className="py-2 text-right">Wartość</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.units.map((u) => (
                      <tr key={u.id} className={cn("border-b align-top", u.id === selected?.id && "bg-secondary")}>
                        <td className="py-3 pr-3 font-bold tabular-nums">{rank.get(u.id)!.p}.</td>
                        <th scope="row" className="py-3 pr-3 font-normal">
                          <Link href={kondycjaHref(layer, indicator.key, u.id)} scroll={false} className={linkClass}>{u.name}</Link>
                          {layer === "gminy" && <span className="block text-muted-foreground">{subtitle(layer, u)}</span>}
                        </th>
                        <td className="py-3 text-right font-bold tabular-nums">{show(u.values[indicator.key], indicator)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {selected && <TerritoryCard layer={layer} unit={selected} indicator={indicator} key={selected.id} />}
      </section>
    </>
  );
}

/**
 * Karta terytorium po kliknięciu: wybrany wskaźnik z miejscem w rankingu, w czym jednostka najbardziej
 * odstaje od reszty, cała kategoria i rozwiązania z Biblioteki dla obszaru. Gmina linkuje do danych swojego powiatu.
 */
async function TerritoryCard({ layer, unit, indicator }: { layer: LayerKey; unit: MapUnit; indicator: MapIndicator }) {
  const L = DATA.layers[layer];
  const words = WORDS[layer];
  const placeOf = (key: string) => places(layer, key).get(unit.id) ?? null;

  const current = placeOf(indicator.key);
  const inCategory = L.indicators.filter((i) => i.category === indicator.category);
  const category = MAP_CATEGORIES.find((c) => c.key === indicator.category);
  // Najbliżej góry albo dołu rankingu; bez liczby mieszkańców — to wielkość, nie kondycja.
  const standouts = L.indicators
    .filter((i) => i.key !== "ludnosc")
    .map((i) => {
      const place = placeOf(i.key);
      return place && { i, place, edge: Math.min(place.p, place.low) - 1 };
    })
    // Wartość dzielona z wieloma innymi (np. zero placówek) niczego nie wyróżnia.
    .filter((s) => s != null && s.edge < 3 && s.place.ties <= 2)
    .sort((a, b) => a!.edge - b!.edge)
    .slice(0, 5) as { i: MapIndicator; place: Place }[];
  const area = indicator.area ?? inCategory.find((i) => i.area)?.area ?? null;
  const innovations = area ? await innovationsForArea(area, []) : [];
  const powiat = layer === "gminy" ? DATA.layers.powiaty.units.find((p) => p.id === unit.id.slice(0, 4)) : null;

  return (
    <section id="karta" aria-labelledby="karta-tytul" className="scroll-my-4 space-y-6 rounded-[16px] bg-secondary px-5 py-6 md:px-8">
      <div className="space-y-1">
        <FocusHeading id="karta-tytul" className="text-2xl font-bold outline-none">{unit.name}</FocusHeading>
        <p className="text-lg">
          {subtitle(layer, unit)}
          {unit.values.ludnosc != null && `. Mieszka tu ${formatNumber(unit.values.ludnosc, 0)} osób`}.
        </p>
      </div>

      <div className="space-y-1">
        <p className="font-bold">{indicator.label}</p>
        <p className="text-3xl font-bold tabular-nums">{show(unit.values[indicator.key], indicator)}</p>
        {current && <p>{current.p}. miejsce na {current.of} {words.gen} (1 = najwyższa wartość).</p>}
      </div>

      {standouts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xl font-bold">Najbardziej odróżnia się od innych {words.gen}</h3>
          <dl className="grid max-w-3xl gap-x-6 sm:grid-cols-[minmax(0,1fr)_auto]">
            {standouts.map(({ i, place }) => (
              <div key={i.key} className="contents">
                <dt className="pt-3 sm:border-t sm:border-border-strong/40">{i.label}</dt>
                <dd className="pb-3 sm:border-t sm:border-border-strong/40 sm:pt-3 sm:text-right">
                  <strong className="tabular-nums">{show(unit.values[i.key], i)}</strong>
                  <span className="block text-base text-muted-foreground">{placeText(place)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {inCategory.length > 1 && (
        <div className="space-y-2">
          <h3 className="text-xl font-bold">{category?.label ?? "Kategoria"}: wszystkie wskaźniki</h3>
          <dl className="grid max-w-3xl gap-x-6 sm:grid-cols-[minmax(0,1fr)_auto]">
            {inCategory.map((i) => {
              const place = placeOf(i.key);
              return (
                <div key={i.key} className="contents">
                  <dt className={cn("pt-3 sm:border-t sm:border-border-strong/40", i.key === indicator.key && "font-bold")}>{i.label}</dt>
                  <dd className="pb-3 sm:border-t sm:border-border-strong/40 sm:pt-3 sm:text-right">
                    <strong className="tabular-nums">{show(unit.values[i.key], i)}</strong>
                    {place && <span className="block text-base text-muted-foreground">{place.p}. miejsce na {place.of}</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {layer === "gminy" && (
        <p>
          <Link href={`/biblioteka/gmina/${unit.id}`} className={cn(linkClass, "inline-flex items-center gap-1")}>
            Raport gminy {unit.name}: obszary do uwagi i sprawdzone rozwiązania
            <ChevronRightIcon aria-hidden className="size-5" />
          </Link>
        </p>
      )}

      {powiat && (
        <p>
          <Link href={kondycjaHref("powiaty", indicator.key, powiat.id)} scroll={false} className={cn(linkClass, "inline-flex items-center gap-1")}>
            Więcej danych: {powiat.name} ({DATA.layers.powiaty.indicators.length} wskaźników)
            <ChevronRightIcon aria-hidden className="size-5" />
          </Link>
        </p>
      )}

      {area && (
        <div className="space-y-3">
          <h3 className="text-xl font-bold">Rozwiązania z Biblioteki: {AREA_LABELS[area].toLowerCase()}</h3>
          {innovations.length ? (
            <ul className="max-w-3xl space-y-2">
              {innovations.map((i) => (
                <li key={i.id}>
                  <Link href={innovationHref(i.slug ?? i.id)} className={linkClass}>{i.title}</Link>
                  {i.solution && <p className="line-clamp-2 text-base text-muted-foreground">{i.solution}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p>W Bibliotece nie ma jeszcze rozwiązań dla tego tematu.</p>
          )}
          <p>
            <Link href={`/biblioteka/obszar/${area.replace(/_/g, "-")}`} className={`inline-flex min-h-12 items-center ${linkClass}`}>
              Wszystkie rozwiązania: {AREA_LABELS[area].toLowerCase()}
            </Link>
          </p>
        </div>
      )}

      <p>
        <Link href={kondycjaHref(layer, indicator.key)} scroll={false} className={linkClass}>Zamknij kartę</Link>
      </p>
    </section>
  );
}
