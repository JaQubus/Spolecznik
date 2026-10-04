import Link from "next/link";
import { cn } from "cn";
import { ChoroplethMap, GMINA_SHAPES, MapLegend } from "@/components/maps/choropleth-map";
import { FocusHeading } from "@/components/a11y/focus-heading";
import { Badge } from "@/components/ui/badge";
import { GAP_LEGEND, gapClass, gapGminaLabel, type Gaps } from "@/lib/knowledge/gaps";
import { formatDate, plural } from "@/lib/pl";
import { AREA_LABELS, GROUP_LABELS } from "@/lib/taxonomy";

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";
const needs = (n: number) => `${n} ${plural(n, "zgłoszenie", "zgłoszenia", "zgłoszeń")}`;
const gminy = (n: number) => `${n} ${plural(n, "gminie", "gminach", "gminach")}`;

/**
 * Mapa luk (README TL;DR pkt 1): gdzie zgłoszone potrzeby nie mają gotowego rozwiązania w Bibliotece,
 * i w jakich obszarach warto otworzyć nabór. Widok tylko dla administratora.
 */
export function GapMap({ gaps, selected, hrefFor }: { gaps: Gaps; selected: string | null; hrefFor: (teryt: string) => string }) {
  const rows = Object.entries(gaps.byGmina)
    .map(([teryt, n]) => ({ teryt, n, label: gapGminaLabel(teryt) }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "pl"));
  const selectedNeeds = selected ? gaps.needs.filter((n) => n.teryt === selected) : [];
  const total = gaps.needs.length;
  const withoutGmina = gaps.needs.filter((n) => !n.teryt).length;

  return (
    <>
      <section aria-labelledby="luki" className="space-y-6">
        <div className="space-y-2">
          <h2 id="luki" className="text-2xl font-bold">Mapa luk: gdzie brakuje rozwiązań</h2>
          <p className="max-w-[44rem] text-lg">
            {total === 0
              ? "Na razie każde zgłoszenie ma przynajmniej jedno pasujące rozwiązanie w Bibliotece."
              : `${needs(total)} bez gotowego rozwiązania${rows.length ? ` w ${gminy(rows.length)}` : ""}. Tak oznaczamy zgłoszenie, gdy najlepsze rozwiązanie z Biblioteki pasuje w mniej niż 50 na 100.`}
          </p>
          {total > 0 && (
            <p className="max-w-[44rem] text-base text-muted-foreground">
              Ocena pochodzi z dnia zgłoszenia. Innowacje dodane później do Biblioteki jej nie zmieniają, więc część luk mogła już zniknąć.
            </p>
          )}
          {withoutGmina > 0 && (
            <p className="max-w-[44rem] text-base text-muted-foreground">
              {withoutGmina === total
                ? "Żadne z nich nie ma podanej gminy, więc mapa jest na razie pusta."
                : `Bez podanej gminy: ${needs(withoutGmina)}. Nie ma ich na mapie.`}{" "}
              Wszystkie liczą się w kierunkach naborów poniżej.
            </p>
          )}
        </div>

        {rows.length > 0 && (
          <>
            <figure className="space-y-4">
              <a href="#tabela-luk" className={cn(linkClass, "sr-only focus:not-sr-only")}>Pomiń mapę i przejdź do tabeli</a>
              <ChoroplethMap
                shapes={GMINA_SHAPES}
                focusable={false}
                title="Mapa luk: liczba zgłoszeń bez rozwiązania w każdej gminie. Te same gminy są w tabeli pod mapą"
                selected={selected}
                items={GMINA_SHAPES.shapes.map((s) => {
                  const n = gaps.byGmina[s.id] ?? 0;
                  return {
                    id: s.id,
                    name: `${gapGminaLabel(s.id)}: ${n ? needs(n) + " bez rozwiązania. Pokaż zgłoszenia" : "brak luk"}`,
                    cls: gapClass(n),
                    href: hrefFor(s.id),
                  };
                })}
              />
              <MapLegend
                title="Zgłoszenia bez gotowego rozwiązania"
                entries={GAP_LEGEND}
                note="Im ciemniejszy kolor, tym więcej zgłoszeń, na które Biblioteka nie ma odpowiedzi. Kliknij gminę albo wybierz ją z tabeli poniżej."
              />
            </figure>

            {selected && (
              <div id="luki-gmina" className="scroll-mt-4 space-y-4">
                {/* Fokus na nagłówku po wyborze gminy: czytnik od razu czyta listę (jak karta gminy w Kondycji). */}
                <FocusHeading as="h3" id="luki-gmina-tytul" key={selected} className="text-xl font-bold outline-none">
                  {gapGminaLabel(selected)}
                </FocusHeading>
                {selectedNeeds.length === 0 ? (
                  <p>W tej gminie nie ma zgłoszeń bez rozwiązania.</p>
                ) : (
                  <ul className="max-w-[48rem] border-t">
                    {selectedNeeds.map((n) => (
                      <li key={n.statusCode} className="grid gap-2 border-b py-4">
                        <p className="text-lg">
                          {n.id
                            ? <Link href={`/panel/zgloszenia/${n.id}`} className={linkClass}>{n.summary}</Link>
                            : n.summary}
                        </p>
                        <p className="text-base text-muted-foreground">
                          <span className="font-mono tracking-wider">{n.statusCode}</span> · {formatDate(n.createdAt)}
                          {n.bestFit != null && ` · najlepsze dopasowanie ${n.bestFit} na 100`}
                        </p>
                        <ul className="flex flex-wrap gap-2" aria-label="Obszary">
                          {n.areas.map((a) => <li key={a}><Badge>{AREA_LABELS[a]}</Badge></li>)}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div id="tabela-luk" tabIndex={-1} className="scroll-mt-4 space-y-3 outline-none">
              <h3 className="text-xl font-bold">Gminy ze zgłoszeniami bez rozwiązania</h3>
              <div role="region" aria-labelledby="tabela-luk-podpis" tabIndex={0} className="max-h-[60vh] max-w-[48rem] overflow-auto">
                <table className="w-full border-collapse text-base">
                  <caption id="tabela-luk-podpis" className="pb-2 text-left text-muted-foreground">
                    {rows.length} {plural(rows.length, "gmina", "gminy", "gmin")}, od największej liczby zgłoszeń.
                  </caption>
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-border-strong">
                      <th scope="col" className="p-3 text-left">Gmina</th>
                      <th scope="col" className="p-3 text-right">Zgłoszenia bez rozwiązania</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.teryt} className={cn("border-b border-border", r.teryt === selected && "bg-secondary")}>
                        <th scope="row" className="p-3 text-left font-normal">
                          <Link href={hrefFor(r.teryt)} className={linkClass} aria-current={r.teryt === selected || undefined}>
                            {r.label}
                          </Link>
                        </th>
                        <td className="p-3 text-right tabular-nums">{r.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      {gaps.directions.length > 0 && (
        <section aria-labelledby="kierunki" className="space-y-4">
          <h2 id="kierunki" className="text-2xl font-bold">Kierunki naborów</h2>
          <p className="max-w-[44rem] text-base text-muted-foreground">
            Obszary Mapy Wyzwań, w których najwięcej zgłoszeń nie ma rozwiązania. Tu nowa innowacja jest najbardziej potrzebna.
            Jedno zgłoszenie może dotyczyć kilku obszarów. Średnie dopasowanie bliskie 50 znaczy, że w Bibliotece jest coś podobnego
            do dostosowania; im niżej, tym bardziej brakuje nowego rozwiązania.
          </p>
          <ol className="max-w-[48rem] border-t">
            {gaps.directions.map((d) => (
              <li key={d.area} className="grid gap-2 border-b py-4">
                <h3 className="text-xl font-bold">{AREA_LABELS[d.area]}</h3>
                <p>
                  {needs(d.needs)} bez rozwiązania
                  {d.gminy > 0 && ` w ${gminy(d.gminy)}`}
                  {d.withoutGmina > 0 && ` (w tym ${d.withoutGmina} bez podanej gminy)`}.
                </p>
                {d.avgFit != null && <p>Najlepsze rozwiązania pasowały średnio w {d.avgFit} na 100.</p>}
                {d.groups.length > 0 && (
                  <p>Najczęściej: {d.groups.map((g) => GROUP_LABELS[g].toLowerCase()).join(", ")}.</p>
                )}
                {d.keywords.length > 0 && (
                  <p className="text-base text-muted-foreground">Częste słowa w zgłoszeniach: {d.keywords.join(", ")}.</p>
                )}
              </li>
            ))}
          </ol>
          <p>
            <Link href="/panel/nabory" className={linkClass}>Przejdź do naborów</Link>, żeby otworzyć nabór w jednym z tych obszarów.
          </p>
        </section>
      )}
    </>
  );
}
