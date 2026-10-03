import { ChevronRightIcon, MapIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { GROUP_ICONS } from "@/components/knowledge/icons";
import { AreaTiles } from "@/components/knowledge/tiles";
import { knowledge } from "@/lib/knowledge";
import { searchKnowledge } from "@/lib/knowledge/search";
import { GROUPS } from "@/lib/schemas";
import { GROUP_LABELS } from "@/lib/taxonomy";
import { AskLibrary } from "./ask-library";
import { ChallengesTab } from "./challenges-tab";
import { LibraryTab, parseLibraryParams } from "./library-tab";
import { MaterialsTab, parseMaterialParams } from "./materials-tab";
import { SearchForm } from "./search-form";
import { resultsSummary, SearchResults } from "./search-results";
import { parseTab, SectionTabs } from "./section-tabs";

export const metadata: Metadata = {
  title: "Biblioteka i wiedza",
  description: "Sprawdzone innowacje społeczne z Małopolski, liczby o regionie i materiały do nauki.",
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function Page(props: PageProps<"/biblioteka">) {
  const sp = await props.searchParams;
  const q = first(sp.q);
  const tab = parseTab(first(sp.tab));
  const [areas, results] = await Promise.all([knowledge.areas(), q ? searchKnowledge(q) : null]);

  return (
    <div className="space-y-16">
      {/* Kremowy pas: białe pole wyszukiwania na kremowym tle (SearchBar.md). */}
      <section className="full-bleed -mt-8 space-y-6 bg-secondary py-12 md:py-16">
        <h1 className="text-4xl font-bold sm:text-5xl">Biblioteka i wiedza</h1>
        <p className="max-w-2xl text-xl">
          Sprawdzone rozwiązania z Małopolski, liczby o naszym regionie i materiały do nauki. W jednym miejscu.
        </p>
        <SearchForm defaultValue={q} />
      </section>

      {/* Zawsze w drzewie, żeby czytnik ekranu ogłosił zmianę po każdym wyszukaniu. */}
      <p role="status" className={results ? "text-lg font-bold" : "sr-only"}>
        {results ? resultsSummary(results) : ""}
      </p>
      {results && <SearchResults results={results} />}

      <section aria-labelledby="tematy" className="space-y-6">
        <h2 id="tematy" className="text-3xl font-bold">Wybierz temat</h2>
        <AreaTiles areas={areas} />
      </section>

      {/* Mapa jest na osobnej stronie, tak jak w main (Kondycja Małopolski). */}
      <section aria-labelledby="kondycja" className="space-y-3">
        <h2 id="kondycja" className="text-3xl font-bold">Kondycja Małopolski</h2>
        <Link href="/biblioteka/kondycja" className="group flex max-w-2xl gap-4 rounded-[16px] py-2">
          <MapIcon aria-hidden className="size-10 shrink-0" />
          <span className="space-y-1">
            <span className="flex items-center gap-1 text-2xl font-bold underline decoration-1 underline-offset-4 group-hover:decoration-2">
              Mapa powiatów
              <ChevronRightIcon aria-hidden className="size-6 shrink-0" />
            </span>
            <span className="block text-lg">Gdzie jest najwięcej seniorów i gdzie najczęściej potrzebna jest pomoc.</span>
          </span>
        </Link>
      </section>

      <section aria-labelledby="dla-kogo" className="space-y-6">
        <h2 id="dla-kogo" className="text-3xl font-bold">Szukam rozwiązania dla…</h2>
        <ul className="flex flex-wrap gap-3">
          {GROUPS.map((g) => {
            const Icon = GROUP_ICONS[g];
            return (
              <li key={g}>
                <Link
                  href={`/biblioteka?tab=library&dla=${g}#dzialy`}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border-strong bg-background px-4 text-lg hover:border-foreground hover:bg-secondary"
                >
                  <Icon aria-hidden className="size-5 shrink-0" />
                  {GROUP_LABELS[g].replace(/^Dla /, "")}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div id="dzialy" className="scroll-mt-4 space-y-10">
        <SectionTabs current={tab} />
        {tab === "library" && <LibraryTab params={parseLibraryParams(sp)} />}
        {tab === "materials" && <MaterialsTab params={parseMaterialParams(sp)} />}
        {tab === "challenges" && <ChallengesTab />}
      </div>

      <section id="zapytaj" aria-labelledby="zapytaj-tytul" className="scroll-mt-4 space-y-4">
        <h2 id="zapytaj-tytul" className="text-3xl font-bold">Zapytaj Bibliotekę</h2>
        <p className="max-w-2xl text-lg">Zadaj pytanie o sytuację w Małopolsce albo o innowacje społeczne.</p>
        <AskLibrary />
      </section>
    </div>
  );
}
