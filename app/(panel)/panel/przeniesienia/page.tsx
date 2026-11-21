import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireAdmin, viewerClient } from "@/lib/auth";
import { listPlans, plannedSources, sourceTitles, type PlanRow } from "@/lib/panel/plans";
import { formatDate, plural } from "@/lib/pl";
import { institutionLabel } from "@/lib/taxonomy";
import { panelTitle } from "@/lib/brand";

export const metadata = { title: panelTitle("Przeniesienia") };

const PAGE_SIZE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";
const selectClass = "h-12 w-full max-w-md rounded-lg border-2 border-input bg-background px-3 text-base hover:border-foreground";
const cellHead = "p-3 text-left align-bottom";
const cell = "p-3 align-top";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Plany z „Przenieś do siebie”: co gminy i instytucje chcą przenosić — sygnał popytu na przenaszalność. */
export default async function Page(props: PageProps<"/panel/przeniesienia">) {
  const viewer = await requireAdmin("/panel/przeniesienia");
  const sp = await props.searchParams;
  const sourceId = UUID.test(first(sp.zrodlo)) ? first(sp.zrodlo) : undefined;
  const page = Math.max(1, Number(first(sp.strona)) || 1);

  // Odczyt sesją użytkownika, jak Adopcje (konto testowe: service role, lib/auth.ts).
  const supabase = await viewerClient(viewer);
  const [{ rows, total }, sources] = await Promise.all([
    listPlans(supabase, { sourceId }, { from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 }),
    plannedSources(supabase),
  ]);
  const titles = await sourceTitles(supabase, rows);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sourceTitle = sources.find((i) => i.id === sourceId)?.title;

  const href = (strona?: number) => {
    const q = new URLSearchParams();
    if (sourceId) q.set("zrodlo", sourceId);
    if (strona && strona > 1) q.set("strona", String(strona));
    const s = q.toString();
    return `/panel/przeniesienia${s ? `?${s}` : ""}`;
  };

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Przeniesienia</h1>
        <p className="max-w-[44rem] text-lg">
          Szkice planów z „Przenieś do siebie”: które inicjatywy i rozwiązania gminy chcą przenosić do siebie.
          Każdy plan to sygnał zainteresowania, nie decyzja o pilotażu.
        </p>
      </div>

      {sources.length > 0 && (
        <section aria-labelledby="najczesciej" className="space-y-3">
          <h2 id="najczesciej" className="text-xl font-bold">Najczęściej planowane</h2>
          <ol className="max-w-[44rem] list-decimal space-y-1 pl-6 text-lg">
            {sources.slice(0, 10).map((i) => (
              <li key={i.id}>
                <Link href={`/panel/przeniesienia?zrodlo=${i.id}`} className={linkClass}>{i.title}</Link>
                {i.kind === "initiative" ? " (inicjatywa z regionu)" : " (rozwiązanie z Polski)"}
                {": "}{i.gminy} {plural(i.gminy, "gmina", "gminy", "gmin")}, {i.plans} {plural(i.plans, "plan", "plany", "planów")}
              </li>
            ))}
          </ol>
        </section>
      )}

      <form action="/panel/przeniesienia" className="flex flex-wrap items-end gap-3">
        <label className="grid w-full max-w-md gap-1 text-base">
          <span className="font-bold">Co przenoszą</span>
          <select name="zrodlo" defaultValue={sourceId ?? ""} className={selectClass}>
            <option value="">Wszystko</option>
            {sources.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </label>
        <Button type="submit" variant="outline">Pokaż</Button>
      </form>

      <p className="text-lg" aria-live="polite">
        {sourceTitle ? <>„{sourceTitle}”</> : "Wszystko"}: <strong>{total}</strong> {plural(total, "plan", "plany", "planów")}
        {pages > 1 && `, strona ${page} z ${pages}`}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">Nie ma tu jeszcze żadnych planów.</p>
      ) : (
        <div role="region" aria-labelledby="tabela-planow" tabIndex={0} className="relative overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <caption id="tabela-planow" className="sr-only">Plany przeniesienia (tabela przewija się w poziomie)</caption>
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className={cellHead}>Co przenoszą</th>
                <th scope="col" className={cellHead}>Gmina</th>
                <th scope="col" className={cellHead}>Instytucja</th>
                <th scope="col" className={cellHead}>Utworzono</th>
                <th scope="col" className={cellHead}><span className="sr-only">Plan</span></th>
              </tr>
            </thead>
            <tbody>{rows.map((r) => <PlanItem key={r.id} plan={r} source={titles.get(r.source_id) ?? null} />)}</tbody>
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

function PlanItem({ plan: p, source }: { plan: PlanRow; source: { title: string; href: string } | null }) {
  const title = source?.title ?? "Pozycja usunięta";
  const where = p.municipalities?.name ?? "gmina nieznana";
  return (
    <tr className="border-b border-border">
      <th scope="row" className={`${cell} min-w-[20ch] text-left font-normal`}>
        {source ? <Link href={source.href} className={linkClass}>{title}</Link> : title}
      </th>
      <td className={cell}>{p.municipalities ? <>{p.municipalities.name}<br /><span className="text-muted-foreground">powiat {p.municipalities.county}</span></> : where}</td>
      <td className={`${cell} min-w-[20ch]`}>{institutionLabel(p.institution_type)}</td>
      <td className={`${cell} whitespace-nowrap`}>{formatDate(p.created_at)}</td>
      <td className={`${cell} whitespace-nowrap`}>
        <Link href={`/panel/przeniesienia/${p.id}`} className={linkClass}>
          Zobacz plan<span className="sr-only">: {title}, {where}</span>
        </Link>
      </td>
    </tr>
  );
}
