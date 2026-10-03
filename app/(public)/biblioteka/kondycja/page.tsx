import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { NoDatabase } from "@/components/layout/no-database";
import { Alert } from "@/components/ui/alert";
import { innovationsForArea } from "@/lib/innovations";
import {
  CLASS_COUNT, KONDYCJA_AREAS, POPULATION_KEY, badness, classOf, compareToRegion, findArea, formatBare, formatValue,
  type KondycjaArea,
} from "@/lib/kondycja";
import { formatNumber } from "@/lib/pl";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getKondycjaData, longName, shortName, type PowiatyData } from "@/lib/powiaty";
import { AREA_LABELS, GROUP_LABELS } from "@/lib/taxonomy";
import { FocusHeading } from "./focus-heading";
import { MAP_FILLS, PowiatyMap } from "./powiaty-map";

export const metadata: Metadata = { title: "Kondycja Małopolski" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";
const chipClass =
  "inline-flex min-h-12 max-w-full items-center gap-2 rounded-full py-2 [overflow-wrap:anywhere] border border-border-strong bg-background px-4 text-base hover:border-foreground aria-[current=true]:border-foreground aria-[current=true]:bg-foreground aria-[current=true]:font-bold aria-[current=true]:text-background";

const href = (area: string, powiat?: string) => `/biblioteka/kondycja?obszar=${area}${powiat ? `&powiat=${powiat}#karta` : ""}`;

/** Wartości głównego wskaźnika obszaru we wszystkich powiatach (bez braków danych). */
function primaryValues(data: PowiatyData, area: KondycjaArea): number[] {
  return Object.values(data.values[area.indicators[0].key] ?? {})
    .map((v) => v.value)
    .filter((v): v is number => v != null);
}

export default async function Page(props: PageProps<"/biblioteka/kondycja">) {
  const params = await props.searchParams;
  const area = findArea(first(params.obszar));
  const connected = isSupabaseConfigured();
  const data: PowiatyData = connected ? await getKondycjaData() : { year: null, powiaty: [], values: {} };
  const primary = area.indicators[0];
  const all = primaryValues(data, area);

  const rows = data.powiaty.map((p) => {
    const v = data.values[primary.key]?.[p.id];
    const value = v?.value ?? null;
    return {
      ...p,
      value,
      unit: v?.unit ?? "",
      cls: value == null ? null : classOf(badness(value, all, primary.worse)),
      sentence: value == null ? null : `${area.sentence(value)} ${compareToRegion(value, all)}`,
    };
  });
  const selected = data.powiaty.find((p) => p.id === first(params.powiat)) ?? null;

  // Legenda: zakres wartości w każdej klasie.
  const legend = Array.from({ length: CLASS_COUNT }, (_, c) => {
    const vs = rows.filter((r) => r.cls === c && r.value != null).map((r) => r.value as number);
    if (!vs.length) return null;
    const unit = rows.find((r) => r.unit)?.unit ?? "";
    const lo = Math.min(...vs), hi = Math.max(...vs);
    return { c, text: lo === hi ? formatBare(lo, unit) : `${formatBare(lo, "")}–${formatBare(hi, unit)}` };
  }).filter((l) => l != null);

  const areaLabel = AREA_LABELS[area.area];

  return (
    <div className="space-y-10">
      <p>
        <Link href="/biblioteka" className={cn(linkClass, "inline-flex items-center gap-2")}>
          <ArrowLeft aria-hidden className="size-5" /> Biblioteka i wiedza
        </Link>
      </p>
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Kondycja Małopolski</h1>
        <p className="max-w-2xl text-xl">
          Wybierz temat, a zobaczysz, jak wygląda w każdym z 22 powiatów. Kliknij powiat, żeby zobaczyć jego najważniejsze liczby i pasujące rozwiązania.
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
          <nav aria-labelledby="tematy" className="space-y-3">
            <h2 id="tematy" className="text-lg font-bold">Temat</h2>
            <ul className="flex flex-wrap gap-2">
              {KONDYCJA_AREAS.map((a) => {
                const current = a.area === area.area;
                return (
                  <li key={a.area} className="max-w-full">
                    <Link href={href(a.area, selected?.id)} scroll={false} aria-current={current} className={chipClass}>
                      {current && <Check aria-hidden className="size-5" />}
                      {AREA_LABELS[a.area]}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section aria-labelledby="obszar" className="space-y-6">
            <div className="space-y-2">
              <h2 id="obszar" className="text-3xl font-bold break-words hyphens-auto">{areaLabel}</h2>
              <p role="status" className="max-w-2xl text-lg">{area.intro} Dane za {data.year} rok.</p>
            </div>

            <figure className="space-y-4">
              <a href="#tabela" className={cn(linkClass, "sr-only focus:not-sr-only")}>Pomiń mapę i przejdź do tabeli</a>
              <PowiatyMap
                title={`Mapa powiatów: ${primary.label}`}
                selected={selected?.id ?? null}
                items={rows.map((r) => ({
                  id: r.id,
                  label: shortName(r.nazwa),
                  name: `${longName(r.nazwa)}: ${formatValue(r.value, r.unit)}. Pokaż kartę powiatu`,
                  cls: r.cls,
                  href: href(area.area, r.id),
                }))}
              />
              <figcaption className="max-w-2xl space-y-3">
                <p className="font-bold">{primary.label}</p>
                <ul aria-label="Legenda mapy" className="flex flex-wrap gap-x-5 gap-y-2 text-base">
                  {legend.map((l) => (
                    <li key={l.c} className="inline-flex items-center gap-2">
                      <span aria-hidden className="size-5 shrink-0 rounded-[4px] border border-border-strong" style={{ background: MAP_FILLS[l.c] }} />
                      {l.text}
                    </li>
                  ))}
                </ul>
                <p className="text-base text-muted-foreground">
                  Im ciemniejszy kolor, tym większe wyzwanie w porównaniu z innymi powiatami. Te same liczby są w tabeli poniżej.
                </p>
              </figcaption>
            </figure>

            {selected && <PowiatCard data={data} powiat={selected} key={selected.id} />}

            <div id="tabela" tabIndex={-1} className="scroll-mt-4 space-y-3 outline-none">
              <h3 className="text-2xl font-bold">Dane w tabeli</h3>
              {/* Szeroka tabela przewija się w poziomie we własnym obszarze (dozwolone przez SC 1.4.10), strona nie. */}
              <div role="region" aria-labelledby="tabela-podpis" tabIndex={0} className="overflow-x-auto rounded-lg">
                <table className="w-full min-w-[44rem] border-collapse text-left text-base">
                  <caption id="tabela-podpis" className="pb-2 text-left text-muted-foreground">
                    {areaLabel}: wskaźniki dla {rows.length} powiatów, {data.year} r. Źródło: Internetowy Obserwator Statystyk Społecznych ROPS.
                  </caption>
                  <thead>
                    <tr className="border-b-2 border-foreground align-bottom">
                      <th scope="col" className="py-2 pr-4">Powiat</th>
                      {area.indicators.map((ind) => <th key={ind.key} scope="col" className="py-2 pr-4">{ind.label}</th>)}
                      <th scope="col" className="py-2">Co to znaczy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={cn("border-b align-top", r.id === selected?.id && "bg-secondary")}>
                        <th scope="row" className="py-3 pr-4 font-normal">
                          <Link href={href(area.area, r.id)} className={linkClass} aria-current={r.id === selected?.id || undefined}>
                            {shortName(r.nazwa)}
                          </Link>
                        </th>
                        {area.indicators.map((ind) => {
                          const v = data.values[ind.key]?.[r.id];
                          return <td key={ind.key} className="py-3 pr-4 whitespace-nowrap">{formatBare(v?.value ?? null, v?.unit ?? "")}</td>;
                        })}
                        <td className="py-3">{r.sentence ?? "Brak danych."}</td>
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

/** Karta powiatu: kluczowe liczby z każdego tematu + rozwiązania dla tematu, w którym powiat wypada najgorzej. */
async function PowiatCard({ data, powiat }: { data: PowiatyData; powiat: { id: string; nazwa: string } }) {
  const population = data.values[POPULATION_KEY]?.[powiat.id]?.value;
  const facts = KONDYCJA_AREAS.map((a) => {
    const v = data.values[a.indicators[0].key]?.[powiat.id];
    const all = primaryValues(data, a);
    return v?.value == null ? null : { a, value: v.value, unit: v.unit, b: badness(v.value, all, a.indicators[0].worse), compare: compareToRegion(v.value, all) };
  }).filter((f) => f != null);
  const worst = facts.reduce<(typeof facts)[number] | null>((w, f) => (w == null || f.b > w.b ? f : w), null);
  const innovations = worst ? await innovationsForArea(worst.a.area, worst.a.groups) : [];

  return (
    <section id="karta" aria-labelledby="karta-tytul" className="scroll-mt-4 space-y-6 rounded-[16px] bg-secondary px-5 py-6 md:px-8">
      <div className="space-y-1">
        <FocusHeading id="karta-tytul" className="text-2xl font-bold outline-none">{longName(powiat.nazwa)}</FocusHeading>
        {population != null && <p className="text-lg">Mieszka tu {formatNumber(population, 0)} osób ({data.year} r.).</p>}
      </div>

      {worst && (
        <p className="max-w-[68ch] text-lg">
          <strong>Największe wyzwanie na tle innych powiatów: {AREA_LABELS[worst.a.area].toLowerCase()}.</strong>{" "}
          {worst.a.sentence(worst.value)}
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-xl font-bold">Najważniejsze liczby</h3>
        <dl className="grid max-w-3xl gap-x-6 sm:grid-cols-[minmax(0,16rem)_1fr]">
          {facts.map((f) => (
            <div key={f.a.area} className="contents">
              <dt className="pt-3 font-bold sm:border-t sm:border-border-strong/40">{AREA_LABELS[f.a.area]}</dt>
              <dd className="pb-3 sm:border-t sm:border-border-strong/40 sm:pt-3">
                {f.a.indicators[0].label}: <strong>{formatBare(f.value, f.unit)}</strong>. {f.compare}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {worst && (
        <div className="space-y-3">
          <h3 className="text-xl font-bold">Rozwiązania z Biblioteki: {AREA_LABELS[worst.a.area].toLowerCase()}</h3>
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
          {worst.a.groups[0] && (
            <p>
              <Link href={`/biblioteka?dla=${worst.a.groups[0]}#innowacje`} className={cn(linkClass, "inline-flex items-center gap-1")}>
                Wszystkie rozwiązania: {GROUP_LABELS[worst.a.groups[0]].toLowerCase()}
                <ChevronRight aria-hidden className="size-5" />
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
