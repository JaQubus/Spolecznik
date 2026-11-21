import { ArrowPathIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { knowledge } from "@/lib/knowledge";
import { MATERIAL_KIND_LABELS } from "@/lib/knowledge/labels";
import { domainLabel } from "@/lib/taxonomy";
import { reindexAll } from "./actions";
import { panelTitle } from "@/lib/brand";

export const metadata: Metadata = { title: panelTitle("Zarządzaj wiedzą"), robots: { index: false } };

const TABS = [
  { key: "rozwiazanie", label: "Sprawdzone rozwiązania", add: "Dodaj rozwiązanie" },
  { key: "fakt", label: "Fakty", add: "Dodaj fakt" },
  { key: "material", label: "Materiały", add: "Dodaj materiał" },
  { key: "dziedzina", label: "Opisy dziedzin", add: null },
] as const;
type Tab = (typeof TABS)[number]["key"];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const Status = ({ published }: { published: boolean }) => (
  <span className={published ? "" : "font-bold"}>{published ? "Opublikowane" : "Ukryte"}</span>
);

const editLink = (kind: Tab, id: string, title: string) => (
  <Link href={`/panel/wiedza/${kind}/${id}`} aria-label={`Edytuj: ${title}`} className="inline-flex min-h-12 items-center font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
    Edytuj
  </Link>
);

export default async function Page(props: PageProps<"/panel/wiedza">) {
  await requireAdmin("/panel/wiedza");
  const sp = await props.searchParams;
  const tab: Tab = TABS.find((t) => t.key === first(sp.rodzaj))?.key ?? "rozwiazanie";
  const current = TABS.find((t) => t.key === tab)!;
  const all = { all: true };
  const [patterns, facts, materials, domains, blocker] = await Promise.all([
    knowledge.patterns({}, all), knowledge.facts(undefined, all), knowledge.materials({}, all), knowledge.domains(all),
    knowledge.store.writeBlocker(),
  ]);
  const cellHead = "p-3 text-left";
  const cell = "p-3 align-top";

  return (
    <section className="space-y-10">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Zarządzaj wiedzą</h1>
        <p className="max-w-[44rem] text-lg">
          Dodawaj i poprawiaj sprawdzone rozwiązania, fakty, materiały i opisy dziedzin. Ukryte rekordy widzisz tylko Ty.
          Po zapisie rozwiązanie trafia do wyszukiwarki po kilku sekundach.
        </p>
        {first(sp.usunieto) && <Alert tone="success" title="Usunięto">Rekord został usunięty.</Alert>}
        {first(sp.indeks) && <Alert tone="success" title="Odświeżam indeks">Wyszukiwarka przelicza wszystkie wpisy. To potrwa kilka minut.</Alert>}
        {knowledge.store.mode === "pliki" && (
          <Alert title="Tryb bez bazy danych">
            <p>{blocker ?? "Zmiany zapisujemy w pliku na tym komputerze (folder .data). Wyszukiwarka widzi je od razu."}</p>
          </Alert>
        )}
      </div>

      <nav aria-label="Rodzaj rekordów" className="border-b border-border">
        <ul className="flex flex-wrap gap-x-2">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/panel/wiedza?rodzaj=${t.key}`}
                aria-current={t.key === tab ? "page" : undefined}
                className={cn("-mb-px inline-flex min-h-12 items-center border-b-4 border-transparent px-4 text-lg hover:border-border-strong",
                  "aria-[current=page]:border-foreground aria-[current=page]:font-bold")}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-wrap items-center gap-4">
        <h2 className="mr-auto text-2xl font-bold">{current.label}</h2>
        {current.add && (
          <Button asChild><Link href={`/panel/wiedza/${tab}/nowy`}><PlusIcon aria-hidden />{current.add}</Link></Button>
        )}
        {knowledge.store.mode === "baza" && (
          <form action={reindexAll}>
            <Button type="submit" variant="outline"><ArrowPathIcon aria-hidden />Odśwież indeks wyszukiwarki</Button>
          </form>
        )}
      </div>

      <div role="region" aria-labelledby="tabela-rekordow" tabIndex={0} className="relative overflow-x-auto">
        <table className="w-full border-collapse text-base">
          <caption id="tabela-rekordow" className="sr-only">{current.label}: lista rekordów</caption>
          {tab === "rozwiazanie" && (
            <>
              <thead><tr className="border-b border-border-strong">
                <th scope="col" className={cellHead}>Nazwa</th><th scope="col" className={cellHead}>Dziedziny</th>
                <th scope="col" className={cellHead}>Film</th><th scope="col" className={cellHead}>Status</th>
                <th scope="col" className={cellHead}><span className="sr-only">Akcje</span></th>
              </tr></thead>
              <tbody>
                {patterns.map((i) => (
                  <tr key={i.id} className="border-b border-border">
                    <th scope="row" className={`${cell} text-left font-normal`}>{i.title}</th>
                    <td className={cell}>{i.domains.map(domainLabel).join(", ")}{i.domainsAuto && " (automatycznie)"}</td>
                    <td className={cell}>{i.video ? "tak" : "nie"}</td>
                    <td className={cell}><Status published={i.published} /></td>
                    <td className={cell}>{editLink("rozwiazanie", i.id, i.title)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          {tab === "fakt" && (
            <>
              <thead><tr className="border-b border-border-strong">
                <th scope="col" className={cellHead}>Liczba</th><th scope="col" className={cellHead}>Dziedzina</th>
                <th scope="col" className={cellHead}>Źródło</th><th scope="col" className={cellHead}>Status</th>
                <th scope="col" className={cellHead}><span className="sr-only">Akcje</span></th>
              </tr></thead>
              <tbody>
                {facts.map((f) => (
                  <tr key={f.id} className="border-b border-border">
                    <th scope="row" className={`${cell} text-left font-normal`}><strong>{f.displayValue}</strong> — {f.sentence}</th>
                    <td className={cell}>{domainLabel(f.domain)}</td>
                    <td className={cell}>{f.isExample ? <strong>przykład</strong> : `${f.sourceTitle ?? "brak"}${f.sourcePage ? `, s. ${f.sourcePage}` : ""}`}</td>
                    <td className={cell}><Status published={f.published} /></td>
                    <td className={cell}>{editLink("fakt", f.id, f.displayValue)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          {tab === "material" && (
            <>
              <thead><tr className="border-b border-border-strong">
                <th scope="col" className={cellHead}>Tytuł</th><th scope="col" className={cellHead}>Rodzaj</th>
                <th scope="col" className={cellHead}>Status</th><th scope="col" className={cellHead}><span className="sr-only">Akcje</span></th>
              </tr></thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-border">
                    <th scope="row" className={`${cell} text-left font-normal`}>{m.title}</th>
                    <td className={cell}>{MATERIAL_KIND_LABELS[m.kind]}</td>
                    <td className={cell}><Status published={m.published} /></td>
                    <td className={cell}>{editLink("material", m.id, m.title)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          {tab === "dziedzina" && (
            <>
              <thead><tr className="border-b border-border-strong">
                <th scope="col" className={cellHead}>Dziedzina</th><th scope="col" className={cellHead}>Zdanie na kafel</th>
                <th scope="col" className={cellHead}>Status</th><th scope="col" className={cellHead}><span className="sr-only">Akcje</span></th>
              </tr></thead>
              <tbody>
                {domains.map((a) => (
                  <tr key={a.key} className="border-b border-border">
                    <th scope="row" className={`${cell} text-left font-normal`}>{a.name}</th>
                    <td className={cell}>{a.lead}</td>
                    <td className={cell}><Status published={a.published} /></td>
                    <td className={cell}>{editLink("dziedzina", a.key, a.name)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
    </section>
  );
}
