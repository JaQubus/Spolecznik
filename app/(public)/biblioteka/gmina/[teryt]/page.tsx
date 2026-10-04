import { ArrowTopRightOnSquareIcon, MegaphoneIcon, UsersIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "cn";
import { Breadcrumbs } from "@/components/knowledge/breadcrumbs";
import { AreaIcon } from "@/components/knowledge/icons";
import { PrintNote } from "@/components/layout/print-note";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { gminaProfile, loadReport, type FocusArea, type GminaReport } from "@/lib/gmina-report";
import type { IndicatorRow } from "@/lib/gmina-report/score";
import { comparisonText, formatNumber, leadIndicator, withUnit } from "@/lib/gmina-report/summary";
import { innovationHref } from "@/lib/knowledge/hrefs";
import { TYPE_LABELS } from "@/lib/knowledge/labels";
import { formatDate, plural } from "@/lib/pl";
import { AREA_LABELS } from "@/lib/taxonomy";
import { LINK as linkClass } from "../../shared";
import { PrintButton } from "../print-button";
import "./print.css";

export async function generateMetadata(props: PageProps<"/biblioteka/gmina/[teryt]">): Promise<Metadata> {
  const p = gminaProfile((await props.params).teryt);
  return p ? { title: `Raport gminy ${p.name} · Biblioteka i wiedza`, description: `Dane gminy ${p.name} na tle gmin podobnych i rozwiązania z Biblioteki.` } : {};
}

const TYPE_WORDS = { miejska: "Gmina miejska", wiejska: "Gmina wiejska", "miejsko-wiejska": "Gmina miejsko-wiejska" } as const;

/** Wartość ze znakiem przy zmianach (np. +1,2%). */
const signed = (v: number, decimals: number) => `${v > 0 ? "+" : ""}${formatNumber(v, decimals)}%`;

/** Źródło w tabeli na wydruku — pełne nazwy są w „Źródła i metoda”. */
const shortSource = (i: IndicatorRow) =>
  `${i.source.title.startsWith("GUS") ? "GUS BDL" : "IOSS ROPS"} ${i.source.year}${i.derived ? ", przeliczone" : ""}`;

const show = (v: number | null, i: IndicatorRow) => (v == null ? "brak danych" : withUnit(v, i.unit, i.decimals));

/** Liczba zgłoszeń z jednej gminy: poniżej 3 bez dokładnej liczby, żeby w małej gminie nie dało się wskazać autora. */
const needsCount = (n: number) => (n < 3 ? "1–2 zgłoszenia" : `${n} ${plural(n, "zgłoszenie", "zgłoszenia", "zgłoszeń")}`);

/**
 * Raport gminy (#104): dane gminy na tle gmin podobnych + sprawdzone rozwiązania z Biblioteki („matchmaking bez zgłoszenia”).
 * Bez wywołań modelu w czasie żądania: liczby liczy lib/gmina-report/score.ts, teksty z modelu są w bazie.
 */
export default async function Page(props: PageProps<"/biblioteka/gmina/[teryt]">) {
  const { teryt } = await props.params;
  if (!/^\d{7}$/.test(teryt)) notFound();
  const report = await loadReport(teryt);
  if (!report) notFound();
  const { profile: p } = report;

  const gminaQuery = `gmina=${encodeURIComponent(p.name)}&teryt=${p.teryt}`;
  const others = p.cohort.members.length - 1;
  const synthetic = report.voices?.synthetic || report.calls.some((c) => c.synthetic)
    || report.focus.some((f) => f.innovations.some((i) => i.synthetic));

  return (
    <article data-print-root className="gmina-report space-y-14">
      <div className="space-y-6">
        <div className="print:hidden">
          <Breadcrumbs items={[{ href: "/biblioteka", label: "Biblioteka i wiedza" }, { href: "/biblioteka/gmina", label: "Raport gminy" }, { label: p.name }]} />
        </div>
        <PrintNote dated>Raport gminy · Małopolski Hub Innowacji Społecznych (hubmi.pl/biblioteka/gmina/{p.teryt})</PrintNote>
        <h1 className="text-4xl font-bold">Raport gminy: {p.name}</h1>
        <p className="text-lg">
          {p.type ? TYPE_WORDS[p.type] : "Gmina"}, {p.powiat}
        </p>
        <section aria-labelledby="w-skrocie" className="max-w-[44rem] space-y-3">
          <h2 id="w-skrocie" className="sr-only">W skrócie</h2>
          <p className="text-xl">{report.summary.text}</p>
          <p className="text-base text-muted-foreground">
            {report.summary.source === "llm"
              ? "Podsumowanie napisał model językowy wyłącznie z liczb tego raportu; każdą liczbę sprawdziliśmy automatycznie."
              : "Podsumowanie złożone automatycznie z liczb tego raportu."}
          </p>
        </section>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 print:hidden">
          <PrintButton />
          <Link href={`/opisz?${gminaQuery}`} className={cn(linkClass, "inline-flex min-h-12 items-center gap-2")}>
            <MegaphoneIcon aria-hidden className="size-5" /> Zgłoś problem z tej gminy
          </Link>
        </div>
        {synthetic && (
          <Alert title="Część danych to przykład">
            <p>Zgłoszenia mieszkańców, nabory i część innowacji w tej wersji demonstracyjnej są przykładowe (wygenerowane). Dane GUS i ROPS są prawdziwe.</p>
          </Alert>
        )}
      </div>

      <Profile report={report} />

      <section aria-labelledby="do-uwagi" className="space-y-8">
        <div className="max-w-[44rem] space-y-3">
          <h2 id="do-uwagi" className="text-3xl font-bold">Obszary do uwagi i sprawdzone rozwiązania</h2>
          <p className="text-lg">
            Obszary, w których potrzeby mieszkańców są tu większe niż w większości gmin podobnych
            ({p.cohort.label}, {others} {plural(others, "gmina", "gminy", "gmin")}). Pod każdym: rozwiązania z Biblioteki Innowacji
            Społecznych, które odpowiadają na ten problem.
          </p>
        </div>
        {report.focus.length ? (
          <ol className="space-y-12">
            {report.focus.map((f, n) => <FocusSection key={f.area} focus={f} report={report} n={n + 1} gminaQuery={gminaQuery} />)}
          </ol>
        ) : (
          <p className="max-w-[44rem] text-lg">
            W żadnym z ośmiu obszarów Mapy Wyzwań potrzeby nie są tu wyraźnie większe niż w gminach podobnych. Pełne zestawienie jest niżej.
          </p>
        )}
      </section>

      <AreasTable report={report} />

      <Voices report={report} gminaQuery={gminaQuery} />

      {report.calls.length > 0 && (
        <section aria-labelledby="nabory" className="max-w-3xl space-y-3">
          <h2 id="nabory" className="text-3xl font-bold">Otwarte nabory w tych obszarach</h2>
          <ul className="divide-y border-y">
            {report.calls.map((c) => (
              <li key={c.id} className="py-4">
                <p className="font-bold">{c.title}{c.synthetic && <span className="font-normal"> (przykład)</span>}</p>
                {c.closesAt && <p className="text-muted-foreground">Wnioski do {formatDate(c.closesAt)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Method report={report} />
    </article>
  );
}

function Profile({ report }: { report: GminaReport }) {
  const p = report.profile;
  const others = p.cohort.members.length - 1;
  const rows: [string, string][] = [
    ["Rodzaj gminy", `${p.type ?? "brak danych"} (z kodu TERYT ${p.teryt})`],
    ["Liczba mieszkańców", p.population != null ? `${formatNumber(p.population, 0)} osób` : "brak danych"],
    ["Zmiana liczby mieszkańców w 10 lat", p.change10y != null ? signed(p.change10y, 1) : "brak danych"],
    ["Osoby w wieku 65+", p.share65 != null ? `${formatNumber(p.share65, 1)}%` : "brak danych"],
    ["Porównujemy z", `${others} ${plural(others, "gminą podobną", "gminami podobnymi", "gminami podobnymi")}: ${p.cohort.label}`],
  ];
  return (
    <section aria-labelledby="profil" className="max-w-3xl space-y-4">
      <h2 id="profil" className="text-3xl font-bold">Profil gminy</h2>
      <dl className="grid gap-x-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="pt-3 sm:border-t sm:border-border-strong/40">{label}</dt>
            <dd className="pb-3 font-bold sm:border-t sm:border-border-strong/40 sm:pt-3 sm:text-right">{value}</dd>
          </div>
        ))}
      </dl>
      {p.source && <p className="text-base text-muted-foreground">Źródło: {p.source.title}, {p.source.year}.</p>}
      {p.small && (
        <Alert title="Mała liczba mieszkańców: wynik orientacyjny">
          <p>W gminie poniżej 5 tysięcy mieszkańców kilka zdarzeń w roku mocno zmienia wskaźniki. Traktuj porównania jako wskazówkę.</p>
        </Alert>
      )}
    </section>
  );
}

function FocusSection({ focus, report, n, gminaQuery }: { focus: FocusArea; report: GminaReport; n: number; gminaQuery: string }) {
  const p = report.profile;
  const area = p.areas.find((a) => a.area === focus.area)!;
  const lead = leadIndicator(p, focus.area);
  const label = AREA_LABELS[focus.area];
  const id = `obszar-${focus.area}`;
  return (
    <li className="space-y-5">
      <section aria-labelledby={id} className="space-y-5">
        <h3 id={id} className="flex items-center gap-3 text-2xl font-bold">
          <AreaIcon area={focus.area} className="size-12" iconClassName="size-7" />
          <span>{n}. {label}</span>
        </h3>
        {lead && (
          <p className="max-w-[44rem] text-lg">
            {lead.label}{lead.level === "powiat" && ` (dane powiatu: ${p.powiat})`}: <strong>{show(lead.value, lead)}</strong>
            {lead.level === "gmina" && lead.cohortMedian != null && <>, typowo w gminach podobnych {show(lead.cohortMedian, lead)}</>}
            {lead.level === "powiat" && lead.regionMedian != null && <>, typowo w powiatach Małopolski {show(lead.regionMedian, lead)}</>}
            {comparisonText(lead) && <> — {comparisonText(lead)}</>}.{" "}
            <span className="text-base text-muted-foreground">Źródło: {lead.source.title}, {lead.source.year}.</span>
          </p>
        )}
        {area.level === "powiat" && (
          <p className="max-w-[44rem] text-base text-muted-foreground print:hidden">
            Dla tego obszaru nie ma danych o gminach, więc pokazujemy dane całego powiatu i porównujemy je z innymi powiatami.
          </p>
        )}

        <div className="max-w-3xl space-y-3">
          <h4 className="text-xl font-bold print:sr-only">Rozwiązania z Biblioteki</h4>
          {!focus.matched && focus.innovations.length > 0 && (
            <p className="text-base text-muted-foreground">Rozwiązania z tego obszaru. Dopasowanie do gmin takich jak Twoja jest w przygotowaniu.</p>
          )}
          {focus.innovations.length ? (
            <ol className="divide-y border-y">
              {focus.innovations.map((i) => (
                <li key={i.id} className="innovation-row space-y-2 py-4">
                  <p className="innovation-title text-lg">
                    <Link href={innovationHref(i.slug ?? i.id)} className={linkClass}>{i.title}</Link>
                    {i.synthetic && <span> (przykład)</span>}
                  </p>
                  <p className="innovation-meta text-base text-muted-foreground">
                    {[
                      i.innovationType && TYPE_LABELS[i.innovationType],
                      i.testsCount > 0
                        ? `przetestowano w ${i.testsCount} ${plural(i.testsCount, "gminie", "gminach", "gminach")}${i.avgRating != null ? `, średnia ocena ${formatNumber(i.avgRating, 1)} na 5` : ""}`
                        : "jeszcze bez testów w Próbie",
                    ].filter(Boolean).join(" · ")}
                  </p>
                  {i.why && (
                    <dl className="text-base">
                      <dt className="font-bold">Dlaczego to może zadziałać u Was</dt>
                      <dd>{i.why}</dd>
                    </dl>
                  )}
                  <p className="print:hidden">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/wdrozenie?innowacja=${encodeURIComponent(i.slug ?? i.id)}&teryt=${p.teryt}`}>Jak wdrożyć to u nas?</Link>
                    </Button>
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p>W Bibliotece nie ma jeszcze rozwiązania dla tego obszaru. To dobry temat na nowy pomysł albo nabór.</p>
          )}
        </div>

        {focus.similarGminy.length > 0 && (
          <div className="max-w-3xl space-y-2">
            <h4 className="flex items-center gap-2 text-xl font-bold">
              <UsersIcon aria-hidden className="size-6 shrink-0" />
              Gminy podobne ze zgłoszeniami w tym obszarze
            </h4>
            <p>
              {focus.similarGminy.slice(0, 8).map((g) => g.name).join(", ")}
              {focus.similarGminy.length > 8 ? ` i ${focus.similarGminy.length - 8} innych` : ""}.
              <span className="print:hidden"> Razem łatwiej znaleźć rozwiązanie i pieniądze na nie.</span>
            </p>
            <p className="print:hidden">
              <Link href={`/opisz?${gminaQuery}&obszar=${focus.area}`} className={linkClass}>
                Opisz ten problem w swojej gminie i połącz się z gminami, które zgłosiły podobny
              </Link>
            </p>
          </div>
        )}
      </section>
    </li>
  );
}

/** Wszystkie 8 obszarów: tabela zamiast wykresu, każda liczba ze źródłem i rokiem. */
function AreasTable({ report }: { report: GminaReport }) {
  const p = report.profile;
  const cell = "px-3 py-3 align-top";
  return (
    <section aria-labelledby="osiem-obszarow" className="space-y-4">
      <h2 id="osiem-obszarow" className="text-3xl font-bold">Osiem obszarów Mapy Wyzwań</h2>
      <p className="max-w-[44rem] text-lg">
        „Typowo” to mediana, czyli wartość środkowa: połowa gmin ma więcej, połowa mniej. Duże miasta, takie jak Kraków, jej nie zawyżają.
      </p>
      <div role="region" aria-labelledby="tabela-obszarow" tabIndex={0} className="relative overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-base">
          <caption id="tabela-obszarow" className="sr-only">Wskaźniki gminy {p.name} w ośmiu obszarach na tle gmin podobnych i Małopolski</caption>
          <thead>
            <tr className="border-b border-border-strong text-left">
              <th scope="col" className={cell}>Obszar i wskaźnik</th>
              <th scope="col" className={cn(cell, "text-right")}>{p.name}</th>
              <th scope="col" className={cn(cell, "text-right")}>Typowo w gminach podobnych</th>
              <th scope="col" className={cn(cell, "text-right")}>Typowo w Małopolsce</th>
              <th scope="col" className={cell}>Na tle porównania</th>
            </tr>
          </thead>
          <tbody>
            {p.areas.map((a) => a.indicators.map((i, k) => (
              <tr key={`${a.area}-${i.key}`} className="border-b border-border">
                <th scope="row" className={cn(cell, "text-left font-normal")}>
                  {k === 0 && (
                    <span className="block font-bold">
                      {AREA_LABELS[a.area]}{p.focus.includes(a.area) && " — obszar do uwagi"}
                    </span>
                  )}
                  {i.label}{i.level === "powiat" && " (dane powiatu)"}
                  <span className="block text-muted-foreground">
                    {i.direction === "need_up" ? "Wyższa wartość: większa potrzeba." : "Niższa wartość: większa potrzeba."}{" "}
                    <span className="print:hidden">{i.source.title}, {i.source.year}{i.derived && "; przeliczone na 10 tys. mieszkańców"}.</span>
                    <span className="hidden print:inline">{shortSource(i)}.</span>
                  </span>
                </th>
                <td className={cn(cell, "text-right font-bold tabular-nums")}>{show(i.value, i)}</td>
                <td className={cn(cell, "text-right tabular-nums")}>{i.level === "gmina" ? show(i.cohortMedian, i) : "nie dotyczy"}</td>
                <td className={cn(cell, "text-right tabular-nums")}>{show(i.regionMedian, i)}{i.level === "powiat" && <span className="block text-muted-foreground">mediana powiatów</span>}</td>
                <td className={cell}>{comparisonText(i) ?? "brak danych"}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Voices({ report, gminaQuery }: { report: GminaReport; gminaQuery: string }) {
  const v = report.voices;
  return (
    <section aria-labelledby="glos" className="max-w-3xl space-y-4">
      <h2 id="glos" className="text-3xl font-bold">Głos mieszkańców</h2>
      {!v ? (
        <p>Zgłoszenia są dostępne, gdy aplikacja jest połączona z bazą danych.</p>
      ) : v.total === 0 ? (
        <p className="text-lg">Z tej gminy nie ma jeszcze zgłoszeń w „Opisz problem”.</p>
      ) : (
        <>
          <p className="text-lg">
            Mieszkańcy, organizacje i instytucje z tej gminy: {needsCount(v.total)} w „Opisz problem”{v.synthetic && " (dane przykładowe)"}.
            Pokazujemy tylko tematy, bez treści zgłoszeń.
          </p>
          <ul className="divide-y border-y">
            {v.byArea.map((a) => (
              <li key={a.area} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-3"><AreaIcon area={a.area} className="size-10" iconClassName="size-6" />{AREA_LABELS[a.area]}</span>
                <strong className="tabular-nums">{needsCount(a.count)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="print:hidden">
        <Link href={`/opisz?${gminaQuery}`} className={linkClass}>Zgłoś problem z tej gminy</Link>
      </p>
    </section>
  );
}

function Method({ report }: { report: GminaReport }) {
  const sources = new Map<string, { title: string; url: string; years: Set<number> }>();
  for (const a of report.profile.areas) for (const i of a.indicators) {
    const s = sources.get(i.source.title) ?? { title: i.source.title, url: i.source.url, years: new Set<number>() };
    s.years.add(i.source.year);
    sources.set(i.source.title, s);
  }
  return (
    <section aria-labelledby="zrodla" className="report-method max-w-[44rem] space-y-4">
      <h2 id="zrodla" className="text-3xl font-bold">Źródła i metoda</h2>
      <ul className="list-disc space-y-2 pl-6">
        {[...sources.values()].map((s) => (
          <li key={s.title}>
            <a href={s.url} className={cn(linkClass, "inline-flex items-center gap-1")}>
              {s.title}<ArrowTopRightOnSquareIcon aria-hidden className="size-4" />
            </a>
            {" "}— dane za {[...s.years].sort().join(", ")}.
          </li>
        ))}
        <li>Obszary i wyzwania: Mapa Wyzwań Społecznych ROPS w Krakowie.</li>
      </ul>
      <ul className="list-disc space-y-2 pl-6">
        <li>Gminy podobne to gminy tego samego rodzaju (miejska, wiejska, miejsko-wiejska) i podobnej wielkości. Za mała grupa łączy się z sąsiednią.</li>
        <li>Obszar do uwagi: potrzeba większa niż w co najmniej 60% gmin podobnych (przy danych powiatu: powiatów), z uwzględnieniem, czy większa wartość oznacza większą potrzebę. Pokazujemy najwyżej trzy.</li>
        <li>Wszystkie liczby policzył program. Model językowy pisze tylko podsumowanie i zdania „dlaczego to może zadziałać”; liczby w nich sprawdzamy automatycznie.</li>
        <li>Rozwiązania dobiera ten sam mechanizm co „Opisz problem”: wyszukiwanie po słowach i ocena dopasowania problemów przez model językowy.</li>
        <li>To materiał wyjściowy, nie ocena gminy. Przed wpisaniem do dokumentów gminy warto sprawdzić dane w źródłach.</li>
      </ul>
      {report.summary.generatedAt && (
        <p className="text-base text-muted-foreground">Teksty raportu przygotowano {formatDate(report.summary.generatedAt)}.</p>
      )}
    </section>
  );
}
