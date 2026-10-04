import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireAdmin, viewerClient } from "@/lib/auth";
import { innovationHref } from "@/lib/knowledge/hrefs";
import { listPlans, plannedInnovations, type PlanRow } from "@/lib/panel/plans";
import { formatDate, plural } from "@/lib/pl";
import { INSTITUTION_LABELS } from "@/lib/schemas";

export const metadata = { title: "Wdrożenia · Panel ROPS" };

const PAGE_SIZE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";
const selectClass = "h-12 w-full max-w-md rounded-lg border-2 border-input bg-background px-3 text-base hover:border-foreground";
const cellHead = "p-3 text-left align-bottom";
const cell = "p-3 align-top";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Page(props: PageProps<"/panel/wdrozenia">) {
  const viewer = await requireAdmin("/panel/wdrozenia");
  const sp = await props.searchParams;
  const innovationId = UUID.test(first(sp.innowacja)) ? first(sp.innowacja) : undefined;
  const page = Math.max(1, Number(first(sp.strona)) || 1);

  // Odczyt sesją użytkownika, jak Testy (konto testowe: service role, lib/auth.ts).
  const supabase = await viewerClient(viewer);
  const [{ rows, total }, innovations] = await Promise.all([
    listPlans(supabase, { innovationId }, { from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 }),
    plannedInnovations(supabase),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const innovationTitle = innovations.find((i) => i.id === innovationId)?.title;

  const href = (strona?: number) => {
    const q = new URLSearchParams();
    if (innovationId) q.set("innowacja", innovationId);
    if (strona && strona > 1) q.set("strona", String(strona));
    const s = q.toString();
    return `/panel/wdrozenia${s ? `?${s}` : ""}`;
  };

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Wdrożenia</h1>
        <p className="max-w-[44rem] text-lg">
          Szkice planów z „Jak to wdrożyć u nas?”: które innowacje gminy i instytucje chcą wdrażać, pod nabór
          „Usługa Wrażliwa”. Każdy plan to sygnał zainteresowania, nie złożony wniosek.
        </p>
      </div>

      {innovations.length > 0 && (
        <section aria-labelledby="najczesciej" className="space-y-3">
          <h2 id="najczesciej" className="text-xl font-bold">Najczęściej planowane innowacje</h2>
          <ol className="max-w-[44rem] list-decimal space-y-1 pl-6 text-lg">
            {innovations.slice(0, 10).map((i) => (
              <li key={i.id}>
                <Link href={`/panel/wdrozenia?innowacja=${i.id}`} className={linkClass}>{i.title}</Link>
                {": "}{i.gminy} {plural(i.gminy, "gmina", "gminy", "gmin")}, {i.plans} {plural(i.plans, "plan", "plany", "planów")}
              </li>
            ))}
          </ol>
        </section>
      )}

      <form action="/panel/wdrozenia" className="flex flex-wrap items-end gap-3">
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
        {innovationTitle ? <>„{innovationTitle}”</> : "Wszystkie innowacje"}: <strong>{total}</strong> {plural(total, "plan", "plany", "planów")}
        {pages > 1 && `, strona ${page} z ${pages}`}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">Nie ma tu jeszcze żadnych planów.</p>
      ) : (
        <div role="region" aria-labelledby="tabela-planow" tabIndex={0} className="relative overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <caption id="tabela-planow" className="sr-only">Plany wdrożenia (tabela przewija się w poziomie)</caption>
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className={cellHead}>Innowacja</th>
                <th scope="col" className={cellHead}>Gmina</th>
                <th scope="col" className={cellHead}>Instytucja</th>
                <th scope="col" className={cellHead}>Utworzono</th>
                <th scope="col" className={cellHead}><span className="sr-only">Plan</span></th>
              </tr>
            </thead>
            <tbody>{rows.map((r) => <PlanItem key={r.id} plan={r} />)}</tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Strony" className="flex flex-wrap gap-6 text-lg">
          {page > 1 && <Link href={href(page - 1)} className={`font-bold ${linkClass}`}>Nowsze plany</Link>}
          {page < pages && <Link href={href(page + 1)} className={`font-bold ${linkClass}`}>Starsze plany</Link>}
        </nav>
      )}
    </section>
  );
}

function PlanItem({ plan: p }: { plan: PlanRow }) {
  const title = p.innovations?.title ?? "Innowacja bez nazwy";
  const where = p.gminy?.nazwa ?? "gmina nieznana";
  return (
    <tr className="border-b border-border">
      <th scope="row" className={`${cell} min-w-[20ch] text-left font-normal`}>
        {p.innovations?.slug ? <Link href={innovationHref(p.innovations.slug)} className={linkClass}>{title}</Link> : title}
      </th>
      <td className={cell}>{p.gminy ? <>{p.gminy.nazwa}<br /><span className="text-muted-foreground">powiat {p.gminy.powiat}</span></> : where}</td>
      <td className={`${cell} min-w-[20ch]`}>{INSTITUTION_LABELS[p.institution_type] ?? p.institution_type}</td>
      <td className={`${cell} whitespace-nowrap`}>{formatDate(p.created_at)}</td>
      <td className={`${cell} whitespace-nowrap`}>
        <Link href={`/panel/wdrozenia/${p.id}`} className={linkClass}>
          Zobacz plan<span className="sr-only">: {title}, {where}</span>
        </Link>
      </td>
    </tr>
  );
}
