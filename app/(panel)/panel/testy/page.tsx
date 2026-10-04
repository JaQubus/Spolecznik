import Form from "next/form";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { requireAdmin } from "@/lib/auth";
import { innovationHref } from "@/lib/knowledge/hrefs";
import { listTests, testedInnovations } from "@/lib/panel/tests";
import { formatDate, plural } from "@/lib/pl";
import { TEST_STATUSES } from "@/lib/schemas";
import { TEST_STATUS_LABELS, type TestStatus } from "@/lib/test-status";
import { ActionForm, SubmitButton } from "../action-form";
import { updateTestStatus } from "../actions";

export const metadata = { title: "Testy · Panel ROPS" };

const selectClass = "h-12 rounded-lg border-2 border-input bg-background px-3 text-base hover:border-foreground";
const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";
const cellHead = "whitespace-nowrap p-3 text-left align-bottom";
const cell = "p-3 align-top";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Zgłoszenia testów i oceny z /przetestuj (Moduł IV Tester innowacji, #59). */
export default async function Page(props: PageProps<"/panel/testy">) {
  await requireAdmin("/panel/testy");
  const sp = await props.searchParams;
  const status = TEST_STATUSES.find((s) => s === first(sp.status));
  const innovationId = UUID.test(first(sp.innowacja)) ? first(sp.innowacja) : undefined;

  const [{ tests, total }, innovations] = await Promise.all([
    listTests({ status, innovationId }),
    testedInnovations(),
  ]);
  const filtered = !!(status || innovationId);
  const synthetic = tests.some((t) => t.synthetic);

  return (
    <section className="min-w-0 space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Testy</h1>
        <p className="max-w-[44rem] text-lg">
          Gminy i organizacje zgłaszają tu chęć przetestowania rozwiązania z Biblioteki i oceniają je po teście.
          Potwierdź pilotaż, gdy ROPS go wspiera. Ostatnie propozycje usprawnień widać też przy edycji rozwiązania w zakładce Wiedza.
        </p>
        {synthetic && (
          <Alert title="Dane przykładowe">
            <p>Część zgłoszeń jest syntetyczna (wygenerowana do demonstracji). Oznaczyliśmy je w kolumnie „Gmina”.</p>
          </Alert>
        )}
      </div>

      <Form action="/panel/testy" scroll={false} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtr-status">Status</Label>
          <NativeSelect id="filtr-status" name="status" defaultValue={status ?? ""} className="sm:w-64">
            <option value="">Wszystkie</option>
            {TEST_STATUSES.map((s) => <option key={s} value={s}>{TEST_STATUS_LABELS[s]}</option>)}
          </NativeSelect>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="filtr-innowacja">Rozwiązanie</Label>
          <NativeSelect id="filtr-innowacja" name="innowacja" defaultValue={innovationId ?? ""} className="sm:w-96">
            <option value="">Wszystkie</option>
            {innovations.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">Pokaż</Button>
        {filtered && <Link href="/panel/testy" className={`${linkClass} inline-flex min-h-12 items-center text-base`}>Wyczyść filtry</Link>}
      </Form>

      <p role="status" className="text-base">
        {total === 0
          ? filtered ? "Brak testów dla tych filtrów." : "Nikt jeszcze nie zgłosił testu."
          : `${total} ${plural(total, "zgłoszenie", "zgłoszenia", "zgłoszeń")}${tests.length < total ? `, pokazujemy ${tests.length} najnowszych` : ""}.`}
      </p>

      {tests.length > 0 && (
        <div role="region" aria-labelledby="tabela-testow" tabIndex={0} className="relative overflow-x-auto">
          <table className="w-full min-w-[72rem] border-collapse text-base">
            <caption id="tabela-testow" className="sr-only">Zgłoszenia testów i oceny po teście</caption>
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className={cellHead}>Rozwiązanie</th>
                <th scope="col" className={cellHead}>Gmina</th>
                <th scope="col" className={cellHead}>Kto testuje</th>
                <th scope="col" className={cellHead}>Termin</th>
                <th scope="col" className={cellHead}>Ocena</th>
                <th scope="col" className={cellHead}>Co działa</th>
                <th scope="col" className={cellHead}>Propozycje usprawnień</th>
                <th scope="col" className={cellHead}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => {
                const title = t.innovations?.title ?? "Bez nazwy";
                const where = t.gminy?.nazwa ?? "nieznana gmina";
                return (
                  <tr key={t.id} className="border-b border-border">
                    <th scope="row" className={`${cell} min-w-[14rem] text-left font-normal`}>
                      <Link href={innovationHref(t.innovations?.slug ?? t.innovation_id)} className={linkClass}>{title}</Link>
                      <span className="block text-muted-foreground">zgłoszono {formatDate(t.created_at)}</span>
                    </th>
                    <td className={cell}>
                      {t.gminy ? <>{t.gminy.nazwa}<span className="block text-muted-foreground">pow. {t.gminy.powiat}</span></> : "—"}
                      {t.synthetic && <strong className="block">przykład</strong>}
                    </td>
                    <td className={`${cell} min-w-[10rem]`}>{t.tester_org ?? <span className="text-muted-foreground">nie podano</span>}</td>
                    <td className={`${cell} whitespace-nowrap`}>{t.planned_for ? formatDate(t.planned_for) : "—"}</td>
                    <td className={`${cell} whitespace-nowrap`}>{t.rating ? <><strong>{t.rating}</strong> / 5</> : "—"}</td>
                    <td className={`${cell} min-w-[16rem] max-w-[24rem]`}>{t.feedback ?? "—"}</td>
                    <td className={`${cell} min-w-[16rem] max-w-[24rem]`}>{t.suggestions ?? "—"}</td>
                    <td className={`${cell} min-w-[14rem]`}>
                      <StatusForm id={t.id} status={t.status} label={`${title}, ${where}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusForm({ id, status, label }: { id: string; status: TestStatus; label: string }) {
  return (
    <ActionForm action={updateTestStatus} className="space-y-2">
      <input type="hidden" name="testId" value={id} />
      <label className="grid gap-1">
        <span className="sr-only">Status testu: {label}</span>
        <select name="status" defaultValue={status} className={selectClass}>
          {TEST_STATUSES.map((s) => <option key={s} value={s}>{TEST_STATUS_LABELS[s]}</option>)}
        </select>
      </label>
      <SubmitButton variant="outline" size="sm" aria-label={`Zapisz status testu: ${label}`}>Zapisz</SubmitButton>
    </ActionForm>
  );
}
