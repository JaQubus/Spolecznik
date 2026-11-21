import { Alert } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/auth";
import { panelTitle } from "@/lib/brand";
import { loadMetricsInput } from "@/lib/panel/metrics-data";
import { systemMetrics, whiteSpots, type SystemMetrics, type WhiteSpotRow } from "@/lib/panel/metrics";
import { formatNumber } from "@/lib/pl";
import { FUNNEL_KEYS, funnelLabel, SECTOR_KEYS, sectorLabel } from "@/lib/taxonomy";

export const metadata = { title: panelTitle("Wskaźniki") };

/** Sektory PCI; „inne” nie jest sektorem priorytetowym, więc nie bywa białą plamą. */
const PCI_SECTORS = SECTOR_KEYS.filter((s) => s !== "inne");

const days = (d: { medianDays: number; n: number } | null) =>
  d ? `${formatNumber(d.medianDays)} dni (mediana z ${d.n} innowacji)` : "brak danych";

/** Wskaźniki skuteczności systemu i białe plamy (powiat × sektor). Tylko zespół PCI. */
export default async function Page() {
  await requireAdmin("/panel/wskazniki");
  let metrics: SystemMetrics | null = null;
  let spots: WhiteSpotRow[] = [];
  try {
    const input = await loadMetricsInput();
    metrics = systemMetrics(input.initiatives, input.contacts);
    spots = whiteSpots(input.initiatives, input.counties, PCI_SECTORS);
  } catch (e) {
    console.error("[panel] wskaźniki:", e);
  }
  const emptyCells = spots.reduce((n, r) => n + r.empty, 0);

  return (
    <section className="max-w-5xl space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Wskaźniki</h1>
        <p className="max-w-[68ch] text-lg">
          Czy Radar rzeczywiście znajduje innowacje i prowadzi je dalej? Liczby poniżej wynikają z lejka i próśb o kontakt z partnerami;
          zgłoszenia scalone jako duplikaty się nie liczą.
        </p>
      </div>

      {!metrics ? (
        <Alert tone="warning" title="Nie udało się wczytać wskaźników">Sprawdź połączenie z bazą i migracje, potem spróbuj ponownie.</Alert>
      ) : (
        <>
          <section aria-labelledby="skutecznosc" className="space-y-4">
            <h2 id="skutecznosc" className="text-2xl font-bold">Skuteczność systemu</h2>
            <dl className="grid max-w-[56rem] gap-x-6 gap-y-3 text-lg sm:grid-cols-[minmax(0,2fr)_3fr]">
              <dt className="font-bold">Innowacje w systemie</dt><dd>{metrics.total}</dd>
              <dt className="font-bold">Wykryte w źródłach</dt><dd>{metrics.detected}</dd>
              <dt className="font-bold">Z nich zweryfikowane</dt>
              <dd>{metrics.detectedVerified}{metrics.detected > 0 && ` (${Math.round((metrics.detectedVerified / metrics.detected) * 100)}%)`}</dd>
              <dt className="font-bold">Czas do pierwszej prośby o kontakt z partnerem</dt><dd>{days(metrics.firstContact)}</dd>
              <dt className="font-bold">Czas do połączenia z partnerem</dt><dd>{days(metrics.connected)}</dd>
              <dt className="font-bold">Ze ścieżką w realizacji</dt>
              <dd>
                {metrics.activePathwayPercent == null
                  ? "brak danych"
                  : `${metrics.activePathwayPercent}% (${metrics.withActivePathway} z ${metrics.assessable})`}
              </dd>
            </dl>
            <p className="max-w-[68ch] text-base text-muted-foreground">
              „Ze ścieżką w realizacji” to innowacje na etapie: w realizacji, wdrożona albo skomercjalizowana, wśród innowacji niezarchiwizowanych
              i potwierdzonych. Czas liczymy od dnia zgłoszenia do pierwszej prośby o kontakt albo do zgody obu stron.
            </p>
          </section>

          <section aria-labelledby="lejek" className="space-y-3">
            <h2 id="lejek" className="text-2xl font-bold">Innowacje według etapu lejka</h2>
            <table className="w-full max-w-xl border-collapse text-lg">
              <caption className="sr-only">Liczba innowacji na każdym etapie lejka</caption>
              <thead><tr className="border-b"><th scope="col" className="p-3 text-left">Etap</th><th scope="col" className="p-3 text-right">Innowacje</th></tr></thead>
              <tbody>
                {FUNNEL_KEYS.map((k) => (
                  <tr key={k} className="border-b"><th scope="row" className="p-3 text-left font-normal">{funnelLabel(k)}</th><td className="p-3 text-right">{metrics.byStage[k]}</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="plamy" className="space-y-3">
            <h2 id="plamy" className="text-2xl font-bold">Białe plamy: powiat × sektor</h2>
            <p className="max-w-[68ch] text-lg">
              Pary powiatu i sektora PCI bez żadnej innowacji: {emptyCells} z {spots.length * PCI_SECTORS.length}. Tam warto szukać i zachęcać do zgłoszeń.
              Powiaty od największej liczby białych plam.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-base">
                <caption className="sr-only">Liczba innowacji w powiatach według sektorów PCI; „brak” oznacza białą plamę</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="p-3 text-left">Powiat</th>
                    {PCI_SECTORS.map((s) => <th key={s} scope="col" className="p-3 text-right">{sectorLabel(s)}</th>)}
                    <th scope="col" className="p-3 text-right">Białe plamy</th>
                  </tr>
                </thead>
                <tbody>
                  {spots.map((r) => (
                    <tr key={r.id} className="border-b">
                      <th scope="row" className="p-3 text-left font-normal">{r.name}</th>
                      {PCI_SECTORS.map((s) => (
                        <td key={s} className={`p-3 text-right ${r.counts[s] === 0 ? "bg-warning-soft font-bold" : ""}`}>{r.counts[s] === 0 ? "brak" : r.counts[s]}</td>
                      ))}
                      <td className="p-3 text-right">{r.empty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
