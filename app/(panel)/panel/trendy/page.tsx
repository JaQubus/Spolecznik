import { ArrowDownTrayIcon, ArrowTrendingDownIcon, ArrowTrendingUpIcon, MinusIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Form from "next/form";
import { DomainTrendCharts, DomainTrendTable } from "@/components/knowledge/trend-charts";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/pl";
import { getGaps } from "@/lib/knowledge/gaps";
import { getClusters } from "@/lib/knowledge/clusters";
import { getTrends, parseBucket } from "@/lib/knowledge/trends";
import { ClusterList } from "./clusters";
import { GapMap } from "./gap-map";
import { panelTitle } from "@/lib/brand";

export const metadata: Metadata = { title: panelTitle("Trendy"), robots: { index: false } };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Widok tylko dla administratora: inicjatywy zagregowane w dziedzinach, powiatach i słowach, plus popyt bez podaży. */
export default async function Page(props: PageProps<"/panel/trendy">) {
  await requireAdmin("/panel/trendy");
  const sp = await props.searchParams;
  const bucket = parseBucket(first(sp.okres));
  const gmina = /^\d{7}$/.test(first(sp.gmina)) ? first(sp.gmina) : null;
  const [t, gaps, clusters] = await Promise.all([getTrends(bucket), getGaps(), getClusters()]);
  const maxCounty = Math.max(1, ...t.byCounty.map((p) => p.initiatives));

  return (
    <section className="space-y-12">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Trendy</h1>
        <p className="max-w-[44rem] text-lg">
          Inicjatywy zgłoszone i wskazane w serwisie: {t.total}, pogrupowane według dziedzin. Niżej popyt bez podaży: czego
          instytucje szukały, a czego w bazie nie było, oraz grupy podobnych inicjatyw.
        </p>
        {t.synthetic && (
          <Alert title="Dane przykładowe">
            <p>Te inicjatywy są syntetyczne (wygenerowane do demonstracji). Nie dotyczą prawdziwych instytucji.</p>
          </Alert>
        )}
      </div>

      <Form action="/panel/trendy" scroll={false} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="okres">Grupuj według</Label>
          <NativeSelect id="okres" name="okres" defaultValue={bucket} className="sm:w-64">
            <option value="week">tygodni</option>
            <option value="month">miesięcy</option>
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">Pokaż</Button>
        <Button asChild>
          <a href={`/panel/trendy/eksport?okres=${bucket}`} download>
            <ArrowDownTrayIcon aria-hidden />Pobierz dane (CSV)
          </a>
        </Button>
      </Form>

      <section aria-labelledby="w-czasie" className="space-y-6">
        <h2 id="w-czasie" className="text-2xl font-bold">Nowe inicjatywy według dziedziny w czasie</h2>
        <p className="text-base text-muted-foreground">
          Każdy wykres to jedna dziedzina, wszystkie w tej samej skali. Jedna inicjatywa może dotyczyć kilku dziedzin.
          Najedź na słupek, żeby zobaczyć liczbę, albo skorzystaj z tabeli poniżej.
        </p>
        <DomainTrendCharts trends={t} />
        <DomainTrendTable trends={t} />
      </section>

      <GapMap gaps={gaps} selected={gmina} hrefFor={(teryt) => `/panel/trendy?okres=${bucket}&gmina=${teryt}#luki-gmina`} />

      <ClusterList data={clusters} />

      <section aria-labelledby="powiaty" className="space-y-4">
        <h2 id="powiaty" className="text-2xl font-bold">Inicjatywy według powiatu</h2>
        <p className="text-base text-muted-foreground">Liczba wszystkich inicjatyw, w nawiasie opublikowane.</p>
        <ul className="max-w-[48rem] space-y-2">
          {t.byCounty.map((p) => (
            <li key={p.county} className="grid grid-cols-[minmax(8rem,12rem)_1fr_5rem] items-center gap-3">
              <span>{p.county}</span>
              <span aria-hidden className="h-3 rounded-r bg-foreground" style={{ width: `${(p.initiatives / maxCounty) * 100}%` }} />
              <span className="text-right tabular-nums">{p.initiatives} ({p.published})</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="slowa" className="space-y-4">
        <h2 id="slowa" className="text-2xl font-bold">Co rośnie: słowa kluczowe</h2>
        <p className="text-base text-muted-foreground">
          Ostatnie 30 dni do {formatDate(t.asOf)} w porównaniu z poprzednimi 30 dniami. Słowa w formie podstawowej z kart inicjatyw i wyzwań.
        </p>
        <div role="region" aria-labelledby="slowa" tabIndex={0} className="relative max-w-[48rem] overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className="p-3 text-left">Słowo</th>
                <th scope="col" className="p-3 text-right">Ostatnie 30 dni</th>
                <th scope="col" className="p-3 text-right">Poprzednie 30 dni</th>
                <th scope="col" className="p-3 text-left">Zmiana</th>
              </tr>
            </thead>
            <tbody>
              {t.keywords.map((k) => {
                const diff = k.recent - k.previous;
                const Icon = diff > 0 ? ArrowTrendingUpIcon : diff < 0 ? ArrowTrendingDownIcon : MinusIcon;
                return (
                  <tr key={k.keyword} className="border-b border-border">
                    <th scope="row" className="p-3 text-left font-normal">{k.keyword}</th>
                    <td className="p-3 text-right tabular-nums">{k.recent}</td>
                    <td className="p-3 text-right tabular-nums">{k.previous}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2">
                        <Icon aria-hidden className="size-5" />
                        {diff > 0 ? `rośnie (+${diff})` : diff < 0 ? `spada (${diff})` : "bez zmian"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
