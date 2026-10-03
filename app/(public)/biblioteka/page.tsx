import { ChevronRight, GraduationCap, Lightbulb, MapPinned, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NoDatabase } from "@/components/layout/no-database";
import { listInnovations } from "@/lib/innovations";
import { formatNumber, plural } from "@/lib/pl";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { GROUP_LABELS } from "@/lib/taxonomy";
import { AskLibrary } from "./ask-library";
import { LibraryFilters } from "./filters";
import { LINK as linkClass, first, isGroup } from "./shared";

export const metadata: Metadata = { title: "Biblioteka i wiedza" };


const ENTRIES = [
  { href: "#innowacje", title: "Innowacje", text: "Sprawdzone rozwiązania z Małopolski: na czym polegają, skąd wiemy, że działają, i jak z nich skorzystać.", Icon: Lightbulb },
  { href: "/biblioteka/kondycja", title: "Kondycja Małopolski", text: "Mapa 183 gmin Małopolski: liczby o mieszkańcach, pomocy społecznej i pracy w każdej gminie.", Icon: MapPinned },
  { href: "/biblioteka/ucz-sie", title: "Ucz się", text: "Przewodniki i raporty ROPS o innowacjach społecznych, opisane prostym językiem.", Icon: GraduationCap },
];

export default async function Page(props: PageProps<"/biblioteka">) {
  const params = await props.searchParams;
  const dla = first(params.dla);
  const group = isGroup(dla) ? dla : null;
  const q = first(params.q).slice(0, 100);
  const connected = isSupabaseConfigured();
  const { items: innovations, total: n } = connected
    ? await listInnovations({ group: group ?? undefined, q })
    : { items: [], total: 0 };
  const filtered = Boolean(group || q);

  return (
    <div className="space-y-12">
      <section aria-labelledby="biblioteka-tytul" className="full-bleed -mt-8 space-y-8 bg-secondary py-10 md:py-12">
        <div className="space-y-3">
          <h1 id="biblioteka-tytul" className="text-4xl font-bold">Biblioteka i wiedza</h1>
          <p className="max-w-2xl text-xl">Sprawdzone rozwiązania, liczby o Małopolsce i materiały do nauki w jednym miejscu.</p>
        </div>
        <nav aria-label="Części biblioteki">
          <ul className="grid gap-x-8 gap-y-2 md:grid-cols-3">
            {ENTRIES.map(({ href, title, text, Icon }) => (
              <li key={href}>
                <Link href={href} className="group flex h-full gap-4 rounded-[16px] py-4 md:flex-col md:gap-3">
                  <Icon aria-hidden className="size-10 shrink-0" strokeWidth={1.75} />
                  <span className="space-y-1">
                    <span className="flex items-center gap-1 text-2xl font-bold underline decoration-1 underline-offset-4 group-hover:decoration-2">
                      {title}
                      <ChevronRight aria-hidden className="size-6 shrink-0" />
                    </span>
                    <span className="block text-lg">{text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <section id="innowacje" aria-labelledby="innowacje-tytul" className="scroll-mt-4 space-y-8">
        <div className="space-y-2">
          <h2 id="innowacje-tytul" className="text-3xl font-bold">Innowacje</h2>
          <p className="max-w-2xl text-lg">Każde rozwiązanie opowiadamy w czterech krokach: problem, rozwiązanie, skąd wiemy, że działa, i jak z niego skorzystać.</p>
        </div>

        {!connected ? (
          <NoDatabase />
        ) : (
          <>
          <LibraryFilters group={group} q={q} />

          {/* Ogłaszane po każdej zmianie filtra — wyniki wymieniają się bez przeładowania strony. */}
          <p role="status" className="text-lg font-bold">
            {n === 0
              ? "Nie znaleźliśmy rozwiązań."
              : `${filtered ? "Znaleźliśmy" : "W bibliotece jest"} ${n} ${plural(n, "rozwiązanie", "rozwiązania", "rozwiązań")}`}
            {n > 0 && group && ` · ${GROUP_LABELS[group].toLowerCase()}`}
            {n > 0 && q && ` · „${q}”`}
          </p>
          {n > innovations.length && (
            <p className="text-base text-muted-foreground">
              Pokazujemy pierwsze {innovations.length}. Zawęź listę filtrem „dla kogo” albo wpisz słowo w wyszukiwarkę.
            </p>
          )}

          {n === 0 ? (
            <div className="max-w-2xl space-y-3 text-lg">
              {filtered ? (
                <>
                  <p>Spróbuj innego słowa albo wybierz „Wszystkie”.</p>
                  <p>
                    Nie ma rozwiązania Twojego problemu?{" "}
                    <Link href="/opisz" className={linkClass}>Opisz problem</Link>, a poszukamy dalej.
                  </p>
                </>
              ) : (
                <p>Biblioteka jest jeszcze pusta. Dane trafiają tu z pipeline&apos;u (data/README.md).</p>
              )}
            </div>
          ) : (
            <ul className="max-w-3xl border-t">
              {innovations.map((i) => (
                <li key={i.id} className="grid gap-2 border-b py-6">
                  <h3 className="text-xl font-bold">
                    <Link href={`/biblioteka/${i.slug ?? i.id}`} className={linkClass}>{i.title}</Link>
                  </h3>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-base text-muted-foreground simple:hidden">
                    {i.category && <span>{i.category}</span>}
                    {i.video_url && (
                      <span className="inline-flex items-center gap-1"><Play aria-hidden className="size-4" /> Z filmem</span>
                    )}
                    {i.synthetic && <span>Przykładowe dane</span>}
                  </p>
                  {/* Tryb prosty: streszczenie łatwe do czytania zamiast opisu (gdy jest). */}
                  <p className={i.etr_summary ? "max-w-[68ch] simple:hidden" : "max-w-[68ch]"}>{i.solution}</p>
                  {i.etr_summary && <p className="hidden max-w-[68ch] simple:block">{i.etr_summary}</p>}
                  {i.tests_count > 0 && (
                    <p className="text-base text-muted-foreground">
                      Przetestowano {i.tests_count} {plural(i.tests_count, "raz", "razy", "razy")}
                      {i.avg_rating != null && `, średnia ocena ${formatNumber(Number(i.avg_rating))} na 5`}.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          </>
        )}
      </section>

      {connected && (
        <section id="zapytaj" aria-labelledby="zapytaj-tytul" className="scroll-mt-4 space-y-4">
          <h2 id="zapytaj-tytul" className="text-3xl font-bold">Zapytaj Bibliotekę</h2>
          <p className="max-w-2xl text-lg">Zadaj pytanie o sytuację w Małopolsce albo o innowacje społeczne.</p>
          <AskLibrary />
        </section>
      )}
    </div>
  );
}
