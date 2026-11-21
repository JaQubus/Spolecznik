import Link from "next/link";
import { cn } from "cn";
import { ChoroplethMap, GMINA_SHAPES, MapLegend } from "@/components/maps/choropleth-map";
import { FocusHeading } from "@/components/a11y/focus-heading";
import { DomainBadge } from "@/components/taxonomy/icons";
import { GAP_LEGEND, gapClass, gapGminaLabel, type Gaps } from "@/lib/knowledge/gaps";
import { formatDate, plural } from "@/lib/pl";
import { domainLabel } from "@/lib/taxonomy";

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";
const challenges = (n: number) => `${n} ${plural(n, "wyzwanie", "wyzwania", "wyzwań")}`;
const gminy = (n: number) => `${n} ${plural(n, "gminie", "gminach", "gminach")}`;

/**
 * „Popyt bez podaży”: gdzie instytucje szukały rozwiązania („Szukam rozwiązania”), a w bazie nie było nic
 * pasującego — i w jakich dziedzinach warto szukać albo wspierać nowe inicjatywy. Widok tylko dla administratora.
 */
export function GapMap({ gaps, selected, hrefFor }: { gaps: Gaps; selected: string | null; hrefFor: (teryt: string) => string }) {
  const rows = Object.entries(gaps.byGmina)
    .map(([teryt, n]) => ({ teryt, n, label: gapGminaLabel(teryt) }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "pl"));
  const selectedRows = selected ? gaps.challenges.filter((n) => n.teryt === selected) : [];
  const total = gaps.challenges.length;
  const withoutGmina = gaps.challenges.filter((n) => !n.teryt).length;

  return (
    <>
      <section aria-labelledby="luki" className="space-y-6">
        <div className="space-y-2">
          <h2 id="luki" className="text-2xl font-bold">Popyt bez podaży: gdzie brakuje rozwiązań</h2>
          <p className="max-w-[44rem] text-lg">
            {total === 0
              ? "Na razie każde wyzwanie miało przynajmniej jedną pasującą inicjatywę albo rozwiązanie."
              : `${challenges(total)} bez gotowego rozwiązania${rows.length ? ` w ${gminy(rows.length)}` : ""}. Tak oznaczamy wyzwanie, gdy najlepsze dopasowanie jest poniżej 50 na 100.`}
          </p>
          {total > 0 && (
            <p className="max-w-[44rem] text-base text-muted-foreground">
              Ocena pochodzi z dnia wyszukiwania. Inicjatywy dodane później jej nie zmieniają, więc część luk mogła już zniknąć.
            </p>
          )}
          {withoutGmina > 0 && (
            <p className="max-w-[44rem] text-base text-muted-foreground">
              {withoutGmina === total
                ? "Żadne z nich nie ma podanej gminy, więc mapa jest na razie pusta."
                : `Bez podanej gminy: ${challenges(withoutGmina)}. Nie ma ich na mapie.`}{" "}
              Wszystkie liczą się w kierunkach poniżej.
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
                title="Mapa luk: liczba wyzwań bez rozwiązania w każdej gminie. Te same gminy są w tabeli pod mapą"
                selected={selected}
                items={GMINA_SHAPES.shapes.map((s) => {
                  const n = gaps.byGmina[s.id] ?? 0;
                  return {
                    id: s.id,
                    name: `${gapGminaLabel(s.id)}: ${n ? challenges(n) + " bez rozwiązania. Pokaż wyzwania" : "brak luk"}`,
                    cls: gapClass(n),
                    href: hrefFor(s.id),
                  };
                })}
              />
              <MapLegend
                title="Wyzwania bez gotowego rozwiązania"
                entries={GAP_LEGEND}
                note="Im ciemniejszy kolor, tym więcej wyzwań, na które baza nie ma odpowiedzi. Kliknij gminę albo wybierz ją z tabeli poniżej."
              />
            </figure>

            {selected && (
              <div id="luki-gmina" className="scroll-mt-4 space-y-4">
                {/* Fokus na nagłówku po wyborze gminy: czytnik od razu czyta listę (jak karta gminy w Kondycji). */}
                <FocusHeading as="h3" id="luki-gmina-tytul" key={selected} className="text-xl font-bold outline-none">
                  {gapGminaLabel(selected)}
                </FocusHeading>
                {selectedRows.length === 0 ? (
                  <p>W tej gminie nie ma wyzwań bez rozwiązania.</p>
                ) : (
                  <ul className="max-w-[48rem] border-t">
                    {selectedRows.map((n) => (
                      <li key={n.id} className="grid gap-2 border-b py-4">
                        <p className="text-lg">{n.summary}</p>
                        <p className="text-base text-muted-foreground">
                          {formatDate(n.createdAt)}
                          {n.bestFit != null && ` · najlepsze dopasowanie ${n.bestFit} na 100`}
                        </p>
                        <ul className="flex flex-wrap gap-2" aria-label="Dziedziny">
                          {n.domains.map((d) => <li key={d}><DomainBadge domain={d} /></li>)}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div id="tabela-luk" tabIndex={-1} className="scroll-mt-4 space-y-3 outline-none">
              <h3 className="text-xl font-bold">Gminy z wyzwaniami bez rozwiązania</h3>
              <div role="region" aria-labelledby="tabela-luk-podpis" tabIndex={0} className="max-h-[60vh] max-w-[48rem] overflow-auto">
                <table className="w-full border-collapse text-base">
                  <caption id="tabela-luk-podpis" className="pb-2 text-left text-muted-foreground">
                    {rows.length} {plural(rows.length, "gmina", "gminy", "gmin")}, od największej liczby wyzwań.
                  </caption>
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-border-strong">
                      <th scope="col" className="p-3 text-left">Gmina</th>
                      <th scope="col" className="p-3 text-right">Wyzwania bez rozwiązania</th>
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
          <h2 id="kierunki" className="text-2xl font-bold">Kierunki programów</h2>
          <p className="max-w-[44rem] text-base text-muted-foreground">
            Dziedziny, w których najwięcej wyzwań nie ma rozwiązania. Tu warto szukać inicjatyw albo wspierać nowe. Jedno wyzwanie
            może dotyczyć kilku dziedzin. Średnie dopasowanie bliskie 50 znaczy, że w bazie jest coś podobnego do dostosowania;
            im niżej, tym bardziej brakuje nowej inicjatywy.
          </p>
          <ol className="max-w-[48rem] border-t">
            {gaps.directions.map((d) => (
              <li key={d.domain} className="grid gap-2 border-b py-4">
                <h3 className="text-xl font-bold">{domainLabel(d.domain)}</h3>
                <p>
                  {challenges(d.challenges)} bez rozwiązania
                  {d.gminy > 0 && ` w ${gminy(d.gminy)}`}
                  {d.withoutGmina > 0 && ` (w tym ${d.withoutGmina} bez podanej gminy)`}.
                </p>
                {d.avgFit != null && <p>Najlepsze rozwiązania pasowały średnio w {d.avgFit} na 100.</p>}
                {d.keywords.length > 0 && (
                  <p className="text-base text-muted-foreground">Częste słowa w wyzwaniach: {d.keywords.join(", ")}.</p>
                )}
              </li>
            ))}
          </ol>
          <p>
            <Link href="/panel/programy" className={linkClass}>Przejdź do programów</Link>, żeby otworzyć program w jednej z tych dziedzin.
          </p>
        </section>
      )}
    </>
  );
}
