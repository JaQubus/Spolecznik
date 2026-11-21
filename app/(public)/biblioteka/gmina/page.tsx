import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/knowledge/breadcrumbs";
import { REPORT_UNITS } from "@/lib/gmina-report";
import { LINK as linkClass } from "../shared";
import { GminaPicker } from "./gmina-picker";

export const metadata: Metadata = {
  title: "Raport gminy · Biblioteka i wiedza",
  description: "Dane każdej gminy Małopolski zestawione z gminami podobnymi i sprawdzone rozwiązania z Biblioteki Innowacji Społecznych.",
};

/** Wybór gminy do raportu. Lista wszystkich gmin pod wyszukiwarką działa też bez JavaScriptu. */
export default function Page() {
  const byPowiat = new Map<string, typeof REPORT_UNITS>();
  for (const u of REPORT_UNITS) {
    const p = u.parent ?? "inne";
    byPowiat.set(p, [...(byPowiat.get(p) ?? []), u]);
  }
  const powiaty = [...byPowiat].sort(([a], [b]) => a.replace(/^powiat /, "").localeCompare(b.replace(/^powiat /, ""), "pl"));

  return (
    <article className="space-y-10">
      <div className="space-y-6">
        <Breadcrumbs items={[{ href: "/biblioteka", label: "Biblioteka i wiedza" }, { label: "Raport gminy" }]} />
        <h1 className="text-4xl font-bold">Raport gminy</h1>
        <p className="max-w-2xl text-xl">
          Od danych do działania: sprawdź, w których obszarach potrzeby mieszkańców Twojej gminy są większe niż w gminach
          podobnych, i zobacz sprawdzone rozwiązania z Biblioteki Innowacji Społecznych.
        </p>
      </div>

      <GminaPicker units={REPORT_UNITS} />

      <details className="max-w-3xl">
        <summary className="min-h-12 cursor-pointer py-3 text-lg font-bold">Wszystkie gminy według powiatów</summary>
        <div className="space-y-6 pt-4">
          {powiaty.map(([powiat, units]) => (
            <section key={powiat} aria-label={powiat} className="space-y-2">
              <h2 className="text-xl font-bold">{powiat}</h2>
              <ul className="flex flex-wrap gap-x-6 gap-y-2">
                {[...units].sort((a, b) => a.name.localeCompare(b.name, "pl")).map((u) => (
                  <li key={u.id}>
                    <Link href={`/biblioteka/gmina/${u.id}`} className={linkClass}>
                      {u.name}
                      {units.filter((x) => x.name === u.name).length > 1 && ` (gmina ${u.kind})`}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </details>
    </article>
  );
}
