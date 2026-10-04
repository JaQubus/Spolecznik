import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireAdmin, viewerClient } from "@/lib/auth";
import { innovationHref } from "@/lib/knowledge/hrefs";
import { listTests, testedInnovations, type TestRow } from "@/lib/panel/tests";
import { formatDate, plural } from "@/lib/pl";
import { TEST_STATUSES } from "@/lib/schemas";
import { TEST_STATUS_LABELS, testStatusLabel, type TestStatus } from "@/lib/test-status";
import { ActionForm, SubmitButton } from "../action-form";
import { updateTestStatus } from "../actions";

export const metadata = { title: "Testy · Panel ROPS" };

const PAGE_SIZE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";
const chipLink =
  "inline-flex min-h-12 items-center rounded-full border border-border-strong px-4 text-base hover:border-foreground aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:font-bold aria-[current=page]:text-background";
const selectClass = "h-12 w-full max-w-md rounded-lg border-2 border-input bg-background px-3 text-base hover:border-foreground";
const cellHead = "p-3 text-left align-bottom";
const cell = "p-3 align-top";
const textCell = `${cell} min-w-[24ch] max-w-[48ch] whitespace-pre-line`;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Page(props: PageProps<"/panel/testy">) {
  const viewer = await requireAdmin("/panel/testy");
  const sp = await props.searchParams;
  const status = TEST_STATUSES.find((s) => s === first(sp.status));
  const innovationId = UUID.test(first(sp.innowacja)) ? first(sp.innowacja) : undefined;
  const page = Math.max(1, Number(first(sp.strona)) || 1);

  // Odczyt sesją użytkownika, jak skrzynka zgłoszeń (konto testowe: service role, lib/auth.ts).
  const supabase = await viewerClient(viewer);
  const [{ rows, total }, innovations] = await Promise.all([
    listTests(supabase, { status, innovationId }, { from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 }),
    testedInnovations(supabase),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const innovationTitle = innovations.find((i) => i.id === innovationId)?.title;

  const href = (p: { status?: TestStatus; strona?: number }) => {
    const q = new URLSearchParams();
    if (p.status) q.set("status", p.status);
    if (innovationId) q.set("innowacja", innovationId);
    if (p.strona && p.strona > 1) q.set("strona", String(p.strona));
    const s = q.toString();
    return `/panel/testy${s ? `?${s}` : ""}`;
  };

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Testy</h1>
        <p className="max-w-[44rem] text-lg">
          Zgłoszenia z formularza „Przetestuj rozwiązanie”: kto chce przetestować innowację, gdzie i kiedy,
          a po teście — ocena i propozycje usprawnień. Potwierdź pilotaż, zmieniając status.
        </p>
      </div>

      <nav aria-label="Filtruj testy po statusie">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href={href({})} aria-current={!status ? "page" : undefined} className={chipLink}>Wszystkie</Link>
          </li>
          {TEST_STATUSES.map((s) => (
            <li key={s}>
              <Link href={href({ status: s })} aria-current={s === status ? "page" : undefined} className={chipLink}>
                {TEST_STATUS_LABELS[s]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form action="/panel/testy" className="flex flex-wrap items-end gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="grid w-full max-w-md gap-1 text-base">
          <span className="font-bold">Innowacja</span>
          <select name="innowacja" defaultValue={innovationId ?? ""} className={selectClass}>
            <option value="">Wszystkie innowacje</option>
            {innovations.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </label>
        <Button type="submit" variant="outline">Pokaż</Button>
      </form>

      <p className="text-lg" aria-live="polite">
        {status ? TEST_STATUS_LABELS[status] : "Wszystkie"}
        {innovationTitle && <> · „{innovationTitle}”</>}: <strong>{total}</strong> {plural(total, "test", "testy", "testów")}
        {pages > 1 && `, strona ${page} z ${pages}`}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">Nie ma tu żadnych testów.</p>
      ) : (
        <div role="region" aria-labelledby="tabela-testow" tabIndex={0} className="relative overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <caption id="tabela-testow" className="sr-only">Zgłoszenia i oceny testów (tabela przewija się w poziomie)</caption>
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className={cellHead}>Innowacja</th>
                <th scope="col" className={cellHead}>Gmina</th>
                <th scope="col" className={cellHead}>Status</th>
                <th scope="col" className={cellHead}>Organizacja</th>
                <th scope="col" className={cellHead}>Planowany termin</th>
                <th scope="col" className={cellHead}>Zgłoszono</th>
                <th scope="col" className={cellHead}>Ocena</th>
                <th scope="col" className={cellHead}>Co działa</th>
                <th scope="col" className={cellHead}>Propozycje usprawnień</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => <TestItem key={t.id} test={t} />)}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Strony" className="flex flex-wrap gap-6 text-lg">
          {page > 1 && <Link href={href({ status, strona: page - 1 })} className={`font-bold ${linkClass}`}>Nowsze testy</Link>}
          {page < pages && <Link href={href({ status, strona: page + 1 })} className={`font-bold ${linkClass}`}>Starsze testy</Link>}
        </nav>
      )}
    </section>
  );
}

const missing = <span className="text-muted-foreground">brak</span>;

/** Wiersz tabeli testów: dane z /przetestuj i formularz statusu (ślad w audit_log). */
function TestItem({ test: t }: { test: TestRow }) {
  const title = t.innovations?.title ?? "Innowacja bez nazwy";
  const where = t.gminy?.nazwa ?? "gmina nieznana";
  return (
    <tr className="border-b border-border">
      <th scope="row" className={`${cell} min-w-[20ch] text-left font-normal`}>
        {t.innovations?.slug ? <Link href={innovationHref(t.innovations.slug)} className={linkClass}>{title}</Link> : title}
        {t.synthetic && <> <strong>(przykład)</strong></>}
      </th>
      <td className={cell}>{t.gminy ? <>{t.gminy.nazwa}<br /><span className="text-muted-foreground">powiat {t.gminy.powiat}</span></> : missing}</td>
      <td className={`${cell} min-w-[14rem]`}>
        <ActionForm action={updateTestStatus} className="grid gap-2">
          <input type="hidden" name="testId" value={t.id} />
          <label className="grid gap-1">
            <span className="sr-only">Status testu „{title}”, {where}</span>
            <select name="status" defaultValue={t.status} className={selectClass}>
              {!TEST_STATUSES.includes(t.status as TestStatus) && <option value={t.status} disabled>{testStatusLabel(t.status)}</option>}
              {TEST_STATUSES.map((s) => <option key={s} value={s}>{TEST_STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <SubmitButton variant="outline" size="sm" aria-label={`Zapisz status testu „${title}”, ${where}`}>Zapisz status</SubmitButton>
        </ActionForm>
      </td>
      <td className={`${cell} min-w-[16ch]`}>{t.tester_org ?? missing}</td>
      <td className={`${cell} whitespace-nowrap`}>{t.planned_for ? formatDate(t.planned_for) : missing}</td>
      <td className={`${cell} whitespace-nowrap`}>{formatDate(t.created_at)}</td>
      <td className={`${cell} whitespace-nowrap`}>{t.rating != null ? <><strong>{t.rating}</strong> na 5</> : missing}</td>
      <td className={textCell}>{t.feedback ?? missing}</td>
      <td className={textCell}>{t.suggestions ?? missing}</td>
    </tr>
  );
}
