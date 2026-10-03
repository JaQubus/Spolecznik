import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { Alert } from "@/components/ui/alert";
import { gminaLabel, listGminy, type Gmina } from "@/lib/gminy";
import { innovationsMatching } from "@/lib/innovations";
import {
  CHALLENGE_MIN, GMINA_TOPICS, badness, classOf, classRanges, regionDirection, worseThanRegion, type GminaTopic,
} from "@/lib/kondycja";
import { formatNumber } from "@/lib/pl";
import { powiatId } from "@/lib/powiaty";
import { LINK as linkClass } from "../shared";
import { ChoroplethMap, GMINA_SHAPES, MapLegend } from "./choropleth-map";
import { FocusHeading } from "./focus-heading";

export const gminyHref = (topic: string, gmina?: string) =>
  `/biblioteka/kondycja?poziom=gminy&temat=${topic}${gmina ? `&gmina=${gmina}#karta` : ""}`;

const valuesOf = (gminy: Gmina[], t: GminaTopic) =>
  gminy.map((g) => g[t.field]).filter((v): v is number => v != null);

/**
 * Kondycja na poziomie 183 gmin (tabela gminy, dane BDL). Tylko dwa tematy, bo tyle wskaźników
 * BDL mamy dla gmin: udział osób 65+ i zmiana liczby mieszkańców w 10 lat.
 */
export async function GminyView({ topic, selectedId, chipClass }: { topic: GminaTopic; selectedId: string; chipClass: string }) {
  const gminy = await listGminy();
  if (!gminy.length) {
    return (
      <Alert title="Brak danych o gminach">
        <p>Dane gmin jeszcze nie zostały wczytane (tabela gminy, data/bdl.py i data/embed.py).</p>
      </Alert>
    );
  }

  const all = valuesOf(gminy, topic);
  const rows = gminy
    .map((g) => {
      const value = g[topic.field];
      return {
        g,
        value,
        cls: value == null ? null : classOf(badness(value, all, topic.worse)),
        sentence: value == null ? null : `${topic.sentence(value)} ${topic.compare(regionDirection(value, all), value)}`,
      };
    })
    .sort((a, b) => a.g.powiat.localeCompare(b.g.powiat, "pl") || a.g.nazwa.localeCompare(b.g.nazwa, "pl"));
  const selected = gminy.find((g) => g.teryt === selectedId) ?? null;
  const legend = classRanges(rows).map(({ c, lo, hi }) => ({
    c,
    text: lo === hi ? topic.format(lo) : `${topic.format(lo)} do ${topic.format(hi)}`,
  }));

  return (
    <>
      <nav aria-labelledby="tematy-gmin" className="space-y-3">
        <h2 id="tematy-gmin" className="text-lg font-bold">Temat</h2>
        <ul className="flex flex-wrap gap-2">
          {GMINA_TOPICS.map((t) => {
            const current = t.key === topic.key;
            return (
              <li key={t.key} className="max-w-full">
                <Link href={gminyHref(t.key, selected?.teryt)} scroll={false} aria-current={current} className={chipClass}>
                  {current && <Check aria-hidden className="size-5" />}
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-labelledby="temat-gmin" className="space-y-6">
        <div className="space-y-2">
          <h2 id="temat-gmin" className="text-3xl font-bold break-words hyphens-auto">{topic.label}</h2>
          <p role="status" className="max-w-2xl text-lg">{topic.intro} Dane z Banku Danych Lokalnych GUS.</p>
        </div>

        <figure className="space-y-4">
          <a href="#tabela-gmin" className={cn(linkClass, "sr-only focus:not-sr-only")}>Pomiń mapę i przejdź do tabeli</a>
          <ChoroplethMap
            shapes={GMINA_SHAPES}
            focusable={false}
            title={`Mapa gmin: ${topic.column}. Każdą gminę wybierzesz też z tabeli pod mapą`}
            selected={selected?.teryt ?? null}
            items={rows.map((r) => ({
              id: r.g.teryt,
              label: r.g.nazwa,
              name: `${gminaLabel(r.g)}: ${r.value == null ? "brak danych" : topic.format(r.value)}. Pokaż kartę gminy`,
              cls: r.cls,
              href: gminyHref(topic.key, r.g.teryt),
            }))}
          />
          <MapLegend
            title={topic.column}
            entries={legend}
            missing={rows.some((r) => r.value == null)}
            note="Im ciemniejszy kolor, tym większe wyzwanie w porównaniu z innymi gminami. Kliknij gminę albo wybierz ją z tabeli poniżej."
          />
        </figure>

        {selected && <GminaCard gminy={gminy} gmina={selected} key={selected.teryt} />}

        <div id="tabela-gmin" tabIndex={-1} className="scroll-mt-4 space-y-3 outline-none">
          <h3 className="text-2xl font-bold">Dane w tabeli</h3>
          <div role="region" aria-labelledby="tabela-gmin-podpis" tabIndex={0} className="max-h-[70vh] overflow-auto rounded-lg">
            <table className="w-full min-w-[44rem] border-collapse text-left text-base">
              <caption id="tabela-gmin-podpis" className="pb-2 text-left text-muted-foreground">
                {topic.label}: {rows.length} gmin Małopolski, ułożone według powiatów. Źródło: Bank Danych Lokalnych GUS.
              </caption>
              <thead className="sticky top-0 bg-background">
                <tr className="border-b-2 border-foreground align-bottom">
                  <th scope="col" className="py-2 pr-4">Gmina</th>
                  <th scope="col" className="py-2 pr-4">Powiat</th>
                  {GMINA_TOPICS.map((t) => <th key={t.key} scope="col" className="py-2 pr-4">{t.column}</th>)}
                  <th scope="col" className="py-2">Co to znaczy</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.g.teryt} className={cn("border-b align-top", r.g.teryt === selected?.teryt && "bg-secondary")}>
                    <th scope="row" className="py-3 pr-4 font-normal">
                      <Link href={gminyHref(topic.key, r.g.teryt)} className={linkClass} aria-current={r.g.teryt === selected?.teryt || undefined}>
                        {r.g.nazwa}
                      </Link>
                      {r.g.typ && !r.g.powiat.startsWith("m. ") && <span className="block text-muted-foreground">gmina {r.g.typ}</span>}
                    </th>
                    <td className="py-3 pr-4">{r.g.powiat}</td>
                    {GMINA_TOPICS.map((t) => {
                      const v = r.g[t.field];
                      return <td key={t.key} className="py-3 pr-4 whitespace-nowrap">{v == null ? "brak danych" : t.format(v)}</td>;
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
  );
}

/** Karta gminy: oba tematy słowami + rozwiązania dla tematów, w których gmina wypada wyraźnie gorzej. */
async function GminaCard({ gminy, gmina }: { gminy: Gmina[]; gmina: Gmina }) {
  const facts = GMINA_TOPICS.map((t) => {
    const value = gmina[t.field];
    const all = valuesOf(gminy, t);
    return value == null ? null : {
      t, value,
      b: badness(value, all, t.worse),
      clearlyWorse: worseThanRegion(value, all, t.worse),
      compare: t.compare(regionDirection(value, all), value),
    };
  }).filter((f) => f != null);
  const challenges = facts.filter((f) => f.b > CHALLENGE_MIN && f.clearlyWorse).sort((x, y) => y.b - x.b);
  const innovations = await Promise.all(challenges.map((c) => innovationsMatching(c.t.innovations)));
  const isCity = gmina.powiat.startsWith("m. ");

  return (
    <section id="karta" aria-labelledby="karta-tytul" className="scroll-mt-4 space-y-6 rounded-[16px] bg-secondary px-5 py-6 md:px-8">
      <div className="space-y-1">
        <FocusHeading id="karta-tytul" className="text-2xl font-bold outline-none">
          {isCity ? gmina.nazwa : `Gmina ${gmina.nazwa}`}
        </FocusHeading>
        <p className="text-lg">
          {isCity ? "Miasto na prawach powiatu" : `Gmina ${gmina.typ ?? ""}, powiat ${gmina.powiat}`}
          {gmina.ludnosc != null && `. Mieszka tu ${formatNumber(gmina.ludnosc, 0)} osób`}.
        </p>
      </div>

      <dl className="grid max-w-3xl gap-x-6 sm:grid-cols-[minmax(0,16rem)_1fr]">
        {facts.map((f) => (
          <div key={f.t.key} className="contents">
            <dt className="pt-3 font-bold sm:border-t sm:border-border-strong/40">{f.t.label}</dt>
            <dd className="pb-3 sm:border-t sm:border-border-strong/40 sm:pt-3">
              <strong>{f.t.format(f.value)}</strong>. {f.t.sentence(f.value)} {f.compare}
            </dd>
          </div>
        ))}
      </dl>

      {challenges.length === 0 && (
        <p className="max-w-[68ch] text-lg">W żadnym z tych tematów gmina nie wypada gorzej niż większość gmin Małopolski.</p>
      )}

      {challenges.map((c, k) => (
        <div key={c.t.key} className="space-y-3">
          <h3 className="text-xl font-bold">Rozwiązania z Biblioteki: {c.t.label.toLowerCase()}</h3>
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
        </div>
      ))}

      <p>
        <Link href={`/biblioteka/kondycja?powiat=${powiatId(gmina.powiat)}#karta`} className={cn(linkClass, "inline-flex items-center gap-1")}>
          {isCity ? "Więcej liczb o tym mieście" : `Więcej liczb: powiat ${gmina.powiat}`}
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </p>
    </section>
  );
}
