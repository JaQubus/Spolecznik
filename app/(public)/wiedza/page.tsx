import type { Metadata } from "next";
import Link from "next/link";
import { DOMAIN_ICONS } from "@/components/taxonomy/icons";
import { searchKnowledge } from "@/lib/knowledge/search";
import { DOMAIN_KEYS, domainLabel } from "@/lib/taxonomy";
import { DomainsTab } from "./domains-tab";
import { MapBanner } from "./map-banner";
import { MaterialsTab, parseMaterialParams } from "./materials-tab";
import { parsePatternParams, PatternsTab } from "./patterns-tab";
import { SearchForm } from "./search-form";
import { resultsSummary, SearchResults } from "./search-results";
import { parseTab, SectionTabs } from "./section-tabs";
import { region } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Wiedza",
  description: `Sprawdzone rozwiązania z Polski, liczby o ${region.genitive} i materiały do nauki.`,
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function Page(props: PageProps<"/wiedza">) {
  const sp = await props.searchParams;
  const q = first(sp.q);
  const tab = parseTab(first(sp.tab));
  const results = q ? await searchKnowledge(q) : null;

  return (
    <div className="space-y-16">
      {/* Kremowy pas: białe pole wyszukiwania na kremowym tle (SearchBar.md) i od razu drugie wejście — dziedziny. */}
      <section className="full-bleed -mt-8 space-y-10 bg-secondary py-12 md:py-16">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold sm:text-5xl">Wiedza</h1>
          <p className="max-w-2xl text-xl">
            Sprawdzone rozwiązania z Polski, liczby o {region.genitive} i materiały, które pomogą rozwinąć i przenieść inicjatywę.
          </p>
          <SearchForm defaultValue={q} />
        </div>
        <div className="space-y-4">
          <h2 id="dziedziny" className="text-2xl font-bold">Rozwiązania w dziedzinie…</h2>
          <ul aria-labelledby="dziedziny" className="flex flex-wrap gap-3">
            {DOMAIN_KEYS.map((d) => {
              const Icon = DOMAIN_ICONS[d];
              return (
                <li key={d}>
                  <Link
                    href={`/wiedza?tab=rozwiazania&dziedzina=${d}#dzialy`}
                    data-domain={d}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border-strong bg-background px-4 text-lg hover:border-foreground hover:bg-secondary"
                  >
                    <Icon aria-hidden className="size-5 shrink-0 text-domain" />
                    {domainLabel(d)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Zawsze w drzewie, żeby czytnik ekranu ogłosił zmianę po każdym wyszukaniu. */}
      <p role="status" className={results ? "text-lg font-bold" : "sr-only"}>
        {results ? resultsSummary(results) : ""}
      </p>
      {results && <SearchResults results={results} />}

      <div id="dzialy" className="scroll-mt-4 space-y-10">
        <SectionTabs current={tab} />
        {tab === "dziedziny" && <DomainsTab />}
        {tab === "rozwiazania" && <PatternsTab params={parsePatternParams(sp)} />}
        {tab === "materialy" && <MaterialsTab params={parseMaterialParams(sp)} />}
      </div>
      <MapBanner />
    </div>
  );
}
