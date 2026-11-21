import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/auth";
import { panelTitle } from "@/lib/brand";
import { plural } from "@/lib/pl";
import { SOURCE_LABELS, SOURCES } from "@/lib/schemas";
import { sourceStats, type SourceStats } from "@/lib/sources";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm, SubmitButton } from "../action-form";
import { scanSources } from "./actions";

export const metadata = { title: panelTitle("Źródła") };

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

/** Radar skanuje (7/10): co jest w migawkach źródeł, ile oceniono, ile kandydatek czeka na przejęcie. */
export default async function Page() {
  await requireAdmin();
  let stats: SourceStats = [];
  let waiting = 0;
  let missing = false;
  try {
    const [s, w] = await Promise.all([
      sourceStats(),
      createAdminClient().from("initiatives").select("id", { count: "exact", head: true }).eq("status", "detected").is("duplicate_of", null),
    ]);
    if (w.error) throw w.error;
    stats = s;
    waiting = w.count ?? 0;
  } catch (e) {
    console.error("[panel] źródła:", e);
    missing = true;
  }
  const bySource = new Map(stats.map((s) => [s.source, s]));
  const pending = stats.reduce((n, s) => n + s.records - s.classified, 0);

  return (
    <section className="max-w-4xl space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Źródła</h1>
        <p className="max-w-[68ch] text-lg">
          Radar przegląda publiczne rejestry: zgłoszenia patentowe, publikacje i projekty instytucji publicznych regionu.
          AI ocenia, czy za rekordem stoi innowacja, i zakłada kartę do przejęcia przez twórcę. Nic nie jest publiczne,
          dopóki twórca jej nie potwierdzi albo zespół nie zweryfikuje.
        </p>
      </div>

      {missing && <Alert tone="warning" title="Brak tabeli źródeł">Zastosuj migrację 0008_source_records.sql i załaduj seed 40_sources.sql.</Alert>}

      <table className="w-full border-collapse text-base">
        <caption className="pb-2 text-left text-muted-foreground">Rekordy w migawkach źródeł (data/raw/sources)</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="p-3 text-left">Źródło</th>
            <th scope="col" className="p-3 text-right">Rekordy</th>
            <th scope="col" className="p-3 text-right">Ocenione</th>
            <th scope="col" className="p-3 text-right">Kandydatki</th>
            <th scope="col" className="p-3 text-left">Dane</th>
          </tr>
        </thead>
        <tbody>
          {SOURCES.map((key) => {
            const s = bySource.get(key);
            return (
              <tr key={key} className="border-b">
                <th scope="row" className="p-3 text-left font-normal">{SOURCE_LABELS[key]}</th>
                <td className="p-3 text-right">{s?.records ?? 0}</td>
                <td className="p-3 text-right">{s?.classified ?? 0}</td>
                <td className="p-3 text-right">{s?.candidates ?? 0}</td>
                <td className="p-3">{!s ? "brak" : s.synthetic === s.records ? "przykładowe" : s.synthetic ? "mieszane" : "prawdziwe"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="text-lg">
        Do oceny: <strong>{pending}</strong> {plural(pending, "rekord", "rekordy", "rekordów")}.{" "}
        Czeka na przejęcie: <strong>{waiting}</strong> {plural(waiting, "wykryta inicjatywa", "wykryte inicjatywy", "wykrytych inicjatyw")}.{" "}
        <Link href="/panel?status=wykryte" className={linkClass}>Pokaż wykryte</Link>
      </p>

      <ActionForm action={scanSources} className="space-y-3">
        <p className="max-w-[68ch] text-muted-foreground">
          Jedno skanowanie ocenia do 3 rekordów (darmowy limit AI). Duplikaty tego samego rozwiązania z różnych źródeł łączymy w jedno zgłoszenie.
        </p>
        <SubmitButton pendingText="Skanowanie…" disabled={missing || pending === 0}>
          <MagnifyingGlassIcon aria-hidden className="size-5" /> Skanuj źródła
        </SubmitButton>
      </ActionForm>

      <section aria-labelledby="ograniczenia" className="space-y-2">
        <h2 id="ograniczenia" className="text-xl font-bold">Ograniczenia</h2>
        <ul className="max-w-[68ch] list-disc space-y-1 pl-6">
          <li>Prawdziwe dane ma dziś tylko Interreg (wykaz projektów). UPRP, EPO, PBN i NCBR to migawki przykładowe: źródła wymagają klucza albo blokują automatyczne zapytania.</li>
          <li>Migawki odświeża pipeline (<code>data/sources</code>), więc dane są tak świeże jak ostatnie uruchomienie.</li>
          <li>AI może się pomylić w ocenie i klasyfikacji — dlatego każda kandydatka czeka na potwierdzenie twórcy albo zespołu.</li>
          <li>Z rekordów usuwamy nazwiska wynalazców i autorów. Zostaje instytucja.</li>
        </ul>
      </section>
    </section>
  );
}
