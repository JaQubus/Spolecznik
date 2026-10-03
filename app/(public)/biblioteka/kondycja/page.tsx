import { ArrowLeftIcon, CheckIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { MAP_CATEGORIES } from "@/components/knowledge/map-categories";
import { NoDatabase } from "@/components/layout/no-database";
import { Alert } from "@/components/ui/alert";
import { innovationsForArea } from "@/lib/innovations";
import {
  CHALLENGE_MIN, CHALLENGE_TIE, KONDYCJA_AREAS, areaLabel, POPULATION_KEY, badness, compareToRegion, worseThanRegion, formatBare,
} from "@/lib/kondycja";
import { classify, ranked, withUnit, type MapData, type MapIndicator } from "@/lib/knowledge/map";
import { formatNumber } from "@/lib/pl";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getKondycjaData, longName, shortName, type PowiatyData } from "@/lib/powiaty";
import { AREA_LABELS, GROUP_LABELS } from "@/lib/taxonomy";
import mapJson from "@/public/mapa/malopolska.json";
import { LINK as linkClass, first } from "../shared";
import { FocusHeading } from "./focus-heading";
import { IndicatorSelect } from "./indicator-select";
import { NO_DATA, PowiatyMap } from "./powiaty-map";

export const metadata: Metadata = { title: "Kondycja Małopolski" };

/** Wszystkie wskaźniki powiatów z IOSS (data/knowledge_map.py), pogrupowane w kategorie jak na mapie gmin. */
const LAYER = (mapJson as unknown as MapData).layers.powiaty;
const TOP = 5;

const chipClass =
  "inline-flex min-h-12 max-w-full items-center gap-2 rounded-full py-2 [overflow-wrap:anywhere] border border-border-strong bg-background px-4 text-base hover:border-foreground aria-[current=true]:border-foreground aria-[current=true]:bg-foreground aria-[current=true]:font-bold aria-[current=true]:text-background";

const href = (indicator: string, powiat?: string) =>
  `/biblioteka/kondycja?wskaznik=${indicator}${powiat ? `&powiat=${powiat}#karta` : ""}`;

/** Wskaźnik z adresu; stare linki ?obszar= trafiają na pierwszy wskaźnik tego obszaru Mapy Wyzwań. */
function findIndicator(key: string | undefined, area: string | undefined): MapIndicator {
  return LAYER.indicators.find((i) => i.key === key) ?? LAYER.indicators.find((i) => area && i.area === area) ?? LAYER.indicators[0];
}

/** Wartości głównego wskaźnika obszaru we wszystkich powiatach (bez braków danych). */
function primaryValues(data: PowiatyData, area: (typeof KONDYCJA_AREAS)[number]): number[] {
  return Object.values(data.values[area.indicators[0].key] ?? {})
    .map((v) => v.value)
    .filter((v): v is number => v != null);
}

export default async function Page(props: PageProps<"/biblioteka/kondycja">) {
  const params = await props.searchParams;
  const indicator = findIndicator(first(params.wskaznik), first(params.obszar));
  const connected = isSupabaseConfigured();
  const data: PowiatyData = connected ? await getKondycjaData() : { year: null, powiaty: [], values: {} };
  const selected = data.powiaty.find((p) => p.id === first(params.powiat)) ?? null;

  // Powiaty z bazy (id jak w kształtach mapy) łączymy z jednostkami pliku mapy po pełnej nazwie.
  const units = new Map(LAYER.units.map((u) => [u.name, u]));
  const order = ranked(LAYER.units, indicator.key);
  const values = order.map((u) => u.values[indicator.key] as number);
  const classes = values.length ? classify(values, indicator) : [];
  const rows = data.powiaty.map((p) => {
    const unit = units.get(longName(p.nazwa));
    const value = unit?.values[indicator.key] ?? null;
    return {
      ...p,
      value,
      place: unit && value != null ? order.indexOf(unit) + 1 : null,
      fill: value == null ? null : classes.find((c) => c.test(value))?.fill ?? null,
    };
  });
  const top = rows.filter((r) => r.place != null).sort((a, b) => a.place! - b.place!).slice(0, TOP);
  const hasMissing = rows.some((r) => r.value == null);
  const show = (v: number | null) =>
    v == null ? "brak danych" : `${indicator.scale === "diverging" && v > 0 ? "+" : ""}${withUnit(v, indicator)}`;

  const categories = MAP_CATEGORIES.filter((c) => LAYER.indicators.some((i) => i.category === c.key));
  const inCategory = LAYER.indicators.filter((i) => i.category === indicator.category);
  const category = categories.find((c) => c.key === indicator.category);

  return (
    <div className="space-y-10">
      <p>
        <Link href="/biblioteka" className={cn(linkClass, "inline-flex items-center gap-2")}>
          <ArrowLeftIcon aria-hidden className="size-5" /> Biblioteka i wiedza
        </Link>
      </p>
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Kondycja Małopolski</h1>
        <p className="max-w-2xl text-xl">
          Wybierz kategorię i wskaźnik, a zobaczysz, jak wygląda w każdym z 22 powiatów. Kliknij powiat, żeby zobaczyć jego najważniejsze liczby i pasujące rozwiązania.
        </p>
      </header>

      {!connected ? (
        <NoDatabase />
      ) : data.year == null ? (
        <Alert title="Brak danych o powiatach">
          <p>Dane jeszcze nie zostały wczytane. Instrukcja jest w pliku data/README.md (import powiatów).</p>
        </Alert>
      ) : (
        <>
          <div className="space-y-6">
            <nav aria-labelledby="kategorie" className="space-y-3">
              <h2 id="kategorie" className="text-lg font-bold">Kategoria</h2>
              <ul className="flex flex-wrap gap-2">
                {categories.map(({ key, label, Icon }) => {
                  const current = key === indicator.category;
                  const firstKey = LAYER.indicators.find((i) => i.category === key)!.key;
                  const count = LAYER.indicators.filter((i) => i.category === key).length;
                  return (
                    <li key={key} className="max-w-full">
                      <Link href={href(firstKey, selected?.id)} scroll={false} aria-current={current} className={chipClass}>
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

          <section aria-labelledby="wskaznik" className="space-y-6">
            <div className="space-y-2">
              {category && <p className="text-base font-bold text-muted-foreground">{category.label}</p>}
              <h2 id="wskaznik" className="text-3xl font-bold break-words hyphens-auto">{indicator.label}</h2>
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
              <a href="#tabela" className={cn(linkClass, "sr-only focus:not-sr-only")}>Pomiń mapę i przejdź do tabeli</a>
              <PowiatyMap
                title={`Mapa powiatów: ${indicator.label}`}
                selected={selected?.id ?? null}
                items={rows.map((r) => ({
                  id: r.id,
                  label: shortName(r.nazwa),
                  name: `${longName(r.nazwa)}: ${show(r.value)}. Pokaż kartę powiatu`,
                  fill: r.fill,
                  href: href(indicator.key, r.id),
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
                  {hasMissing && (
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
              <h3 id="top" className="text-2xl font-bold">{TOP} powiatów z najwyższą wartością</h3>
              <div role="region" aria-labelledby="top" tabIndex={0} className="max-w-2xl overflow-x-auto rounded-lg">
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
                          <Link href={href(indicator.key, r.id)} className={linkClass}>{longName(r.nazwa)}</Link>
                        </th>
                        <td className="py-3 text-right font-bold whitespace-nowrap tabular-nums">{show(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selected && <PowiatCard data={data} powiat={selected} key={selected.id} />}

            <div id="tabela" tabIndex={-1} className="scroll-mt-4 space-y-3 outline-none">
              <h3 className="text-2xl font-bold">Dane w tabeli</h3>
              <div role="region" aria-labelledby="tabela-podpis" tabIndex={0} className="max-w-2xl overflow-x-auto rounded-lg">
                <table className="w-full border-collapse text-left text-base">
                  <caption id="tabela-podpis" className="pb-2 text-left text-muted-foreground">
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
                          <Link href={href(indicator.key, r.id)} className={linkClass} aria-current={r.id === selected?.id || undefined}>
                            {shortName(r.nazwa)}
                          </Link>
                        </th>
                        <td className="py-3 pr-4 text-right whitespace-nowrap tabular-nums">{show(r.value)}</td>
                        <td className="py-3 text-right tabular-nums">{r.place ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** Karta powiatu: kluczowe liczby z każdego tematu + rozwiązania dla tematów, w których powiat wypada gorzej niż większość. */
async function PowiatCard({ data, powiat }: { data: PowiatyData; powiat: { id: string; nazwa: string } }) {
  const population = data.values[POPULATION_KEY]?.[powiat.id]?.value;
  const facts = KONDYCJA_AREAS.map((a) => {
    const v = data.values[a.indicators[0].key]?.[powiat.id];
    const all = primaryValues(data, a);
    const worse = a.indicators[0].worse;
    return v?.value == null ? null : {
      a, value: v.value, unit: v.unit,
      b: badness(v.value, all, worse),
      // „Wyzwanie” tylko, gdy wartość jest też wyraźnie gorsza od mediany — inaczej karta przeczyłaby sama sobie.
      clearlyWorse: worseThanRegion(v.value, all, worse),
      compare: compareToRegion(v.value, all),
    };
  }).filter((f) => f != null);
  const ranked = facts.filter((f) => f.b > CHALLENGE_MIN && f.clearlyWorse).sort((x, y) => y.b - x.b);
  const challenges = ranked.filter((f, k) => k === 0 || (k === 1 && ranked[0].b - f.b <= CHALLENGE_TIE));
  const innovations = await Promise.all(challenges.map((c) => innovationsForArea(c.a.area, c.a.groups)));

  return (
    <section id="karta" aria-labelledby="karta-tytul" className="scroll-mt-4 space-y-6 rounded-[16px] bg-secondary px-5 py-6 md:px-8">
      <div className="space-y-1">
        <FocusHeading id="karta-tytul" className="text-2xl font-bold outline-none">{longName(powiat.nazwa)}</FocusHeading>
        {population != null && <p className="text-lg">Mieszka tu {formatNumber(population, 0)} osób ({data.year} r.).</p>}
      </div>

      {challenges.length ? (
        challenges.map((c, k) => (
          <p key={c.a.area} className="max-w-[68ch] text-lg">
            <strong>
              {k === 0 ? "Największe wyzwanie na tle innych powiatów" : "Prawie tak samo duże wyzwanie"}: {areaLabel(c.a).toLowerCase()}.
            </strong>{" "}
            {c.a.sentence(c.value)} {c.compare}
          </p>
        ))
      ) : (
        <p className="max-w-[68ch] text-lg">
          W żadnym z tematów ten powiat nie wypada gorzej niż większość powiatów Małopolski.
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-xl font-bold">Najważniejsze liczby</h3>
        <dl className="grid max-w-3xl gap-x-6 sm:grid-cols-[minmax(0,16rem)_1fr]">
          {facts.map((f) => (
            <div key={f.a.area} className="contents">
              <dt className="pt-3 font-bold sm:border-t sm:border-border-strong/40">{areaLabel(f.a)}</dt>
              <dd className="pb-3 sm:border-t sm:border-border-strong/40 sm:pt-3">
                {f.a.indicators[0].label}: <strong>{formatBare(f.value, f.unit)}</strong>. {f.compare}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {challenges.map((c, k) => (
        <div key={c.a.area} className="space-y-3">
          <h3 className="text-xl font-bold">Rozwiązania z Biblioteki: {areaLabel(c.a).toLowerCase()}</h3>
          {innovations[k].length ? (
            <ul className="max-w-3xl space-y-2">
              {innovations[k].map((i) => (
                <li key={i.id}>
                  <Link href={`/biblioteka/${i.slug ?? i.id}`} className={linkClass}>{i.title}</Link>
                  {i.solution && <p className="line-clamp-2 text-base text-muted-foreground">{i.solution}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p>W Bibliotece nie ma jeszcze rozwiązań dla tego tematu.</p>
          )}
          {c.a.groups[0] && (
            <p>
              <Link href={`/biblioteka?dla=${c.a.groups[0]}#innowacje`} className={cn(linkClass, "inline-flex items-center gap-1")}>
                Wszystkie rozwiązania: {GROUP_LABELS[c.a.groups[0]].toLowerCase()}
                <ChevronRightIcon aria-hidden className="size-5" />
              </Link>
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
