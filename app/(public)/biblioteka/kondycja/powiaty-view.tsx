import Link from "next/link";
import { cn } from "cn";
import { Alert } from "@/components/ui/alert";
import { listPowiatyIndicators, listPowiatyValues } from "@/lib/powiaty";
import { LINK as linkClass } from "../shared";

const chipClass =
  "inline-flex min-h-11 max-w-full items-center rounded-full border border-border-strong bg-background px-4 py-2 text-base [overflow-wrap:anywhere] hover:border-foreground aria-[current=true]:border-foreground aria-[current=true]:bg-foreground aria-[current=true]:font-bold aria-[current=true]:text-background";

const indicatorHref = (indicator: string) => `/biblioteka/kondycja?poziom=powiaty&wskaznik=${encodeURIComponent(indicator)}`;
const categoryId = (category: string) => `powiaty-${category.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;

/** Wskaźnik pokazywany, gdy w adresie nie ma żadnego: najbliższy temu, czym zajmuje się ROPS. */
const DEFAULT_INDICATOR = "Beneficjenci pomocy społecznej";

/** Wynik powiatu na tle mediany Małopolski, słowami. ±5% mediany to „mniej więcej tyle samo”. */
function compareToMedian(value: number | null, median: number | null) {
  if (value == null || median == null) return "Brak danych do porównania.";
  if (Math.abs(value - median) <= Math.abs(median) * 0.05) return "Mniej więcej tyle samo co w typowym powiecie Małopolski.";
  return value > median ? "Więcej niż w większości powiatów Małopolski." : "Mniej niż w większości powiatów Małopolski.";
}

function medianOf(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatValue(value: number | null, unit: string) {
  if (value == null) return "brak danych";
  return `${value.toLocaleString("pl-PL", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

export async function PowiatyView({ requested }: { requested?: string }) {
  const indicators = await listPowiatyIndicators();
  if (!indicators.length) {
    return (
      <Alert title="Dane powiatowe są chwilowo niedostępne">
        <p>Nie udało się jeszcze wczytać wskaźników dla powiatów. Spróbuj ponownie później.</p>
      </Alert>
    );
  }
  const indicator =
    indicators.find((i) => i.wskaznik === requested) ??
    indicators.find((i) => i.wskaznik === DEFAULT_INDICATOR) ??
    indicators[0];
  const values = await listPowiatyValues(indicator.wskaznik);
  const median = medianOf(values.map((v) => v.wartosc).filter((v): v is number => v != null));
  const categories = [...new Set(indicators.map((i) => i.kategoria))];

  return (
    <section className="space-y-8" aria-labelledby="powiaty-temat">
      <div className="space-y-2">
        <h2 id="powiaty-temat" className="text-3xl font-bold">Kondycja powiatów</h2>
        <p className="max-w-2xl text-lg">
          Wybierz wskaźnik, a zobaczysz, jak wypada każdy z 22 powiatów Małopolski na tle pozostałych.
        </p>
      </div>
      <nav aria-labelledby="powiaty-kategorie" className="space-y-3">
        <h3 id="powiaty-kategorie" className="text-lg font-bold">Kategorie</h3>
        <ul className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <li key={category}><a href={`#${categoryId(category)}`} className={chipClass}>{category}</a></li>
          ))}
        </ul>
      </nav>
      <div className="space-y-6">
        {categories.map((category) => (
          <section key={category} id={categoryId(category)} className="scroll-mt-4 space-y-3">
            <h3 className="text-xl font-bold">{category}</h3>
            <ul className="flex flex-wrap gap-2">
              {indicators.filter((i) => i.kategoria === category).map((i) => (
                <li key={i.wskaznik}>
                  <Link href={indicatorHref(i.wskaznik)} aria-current={i.wskaznik === indicator.wskaznik} className={chipClass}>
                    {i.wskaznik}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="space-y-3">
        <h3 className="text-2xl font-bold">{indicator.wskaznik}</h3>
        {indicator.opis && <p className="max-w-3xl text-muted-foreground">{indicator.opis}</p>}
        <div className="overflow-auto rounded-lg">
          <table className="w-full min-w-[42rem] border-collapse text-left text-base">
            <caption className="pb-2 text-left text-muted-foreground">
              {indicator.wskaznik}: {values.length} powiatów Małopolski, dane z roku {values[0]?.rok ?? "—"}.
            </caption>
            <thead className="bg-background">
              <tr className="border-b-2 border-foreground">
                <th scope="col" className="py-2 pr-4">Powiat</th>
                <th scope="col" className="py-2 pr-4">Wynik</th>
                <th scope="col" className="py-2">Na tle Małopolski</th>
              </tr>
            </thead>
            <tbody>
              {values.map((row) => (
                <tr key={row.powiat} className="border-b align-top">
                  <th scope="row" className="py-3 pr-4 font-normal">{row.nazwa}</th>
                  <td className="py-3 pr-4 whitespace-nowrap">{formatValue(row.wartosc, row.jednostka)}</td>
                  <td className="py-3">{compareToMedian(row.wartosc, median)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={cn("text-base", "text-muted-foreground")}>Źródło: Internetowy Obserwator Statystyk Społecznych.</p>
        <p className="text-lg">
          <Link href="/biblioteka#innowacje" className={linkClass}>Zobacz sprawdzone rozwiązania w Bibliotece</Link>
        </p>
      </div>
    </section>
  );
}
