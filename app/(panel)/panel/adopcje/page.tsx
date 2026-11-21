import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireAdmin, viewerClient } from "@/lib/auth";
import { adoptedSources, adoptionSource, listAdoptions, type AdoptionRow } from "@/lib/panel/adoptions";
import { formatDate, plural } from "@/lib/pl";
import { ADOPTION_STATUSES } from "@/lib/schemas";
import { ADOPTION_STATUS_LABELS, adoptionStatusLabel, type AdoptionStatus } from "@/lib/adoption-status";
import { ActionForm, SubmitButton } from "../action-form";
import { updateAdoptionStatus } from "../actions";
import { panelTitle } from "@/lib/brand";

export const metadata = { title: panelTitle("Adopcje") };

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

export default async function Page(props: PageProps<"/panel/adopcje">) {
  const viewer = await requireAdmin("/panel/adopcje");
  const sp = await props.searchParams;
  const status = ADOPTION_STATUSES.find((s) => s === first(sp.status));
  const sourceId = UUID.test(first(sp.zrodlo)) ? first(sp.zrodlo) : undefined;
  const page = Math.max(1, Number(first(sp.strona)) || 1);

  // Odczyt sesją użytkownika, jak lista inicjatyw (konto testowe: service role, lib/auth.ts).
  const supabase = await viewerClient(viewer);
  const [{ rows, total }, sources] = await Promise.all([
    listAdoptions(supabase, { status, sourceId }, { from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 }),
    adoptedSources(supabase),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sourceTitle = sources.find((i) => i.id === sourceId)?.title;

  const href = (p: { status?: AdoptionStatus; strona?: number }) => {
    const q = new URLSearchParams();
    if (p.status) q.set("status", p.status);
    if (sourceId) q.set("zrodlo", sourceId);
    if (p.strona && p.strona > 1) q.set("strona", String(p.strona));
    const s = q.toString();
    return `/panel/adopcje${s ? `?${s}` : ""}`;
  };

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Adopcje</h1>
        <p className="max-w-[44rem] text-lg">
          Zgłoszenia z formularza „Wypróbowaliśmy u nas”: kto przenosi inicjatywę albo rozwiązanie, gdzie i kiedy,
          a po pilotażu — ocena i propozycje usprawnień. Potwierdź przeniesienie, zmieniając status.
        </p>
      </div>

      <nav aria-label="Filtruj adopcje po statusie">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href={href({})} aria-current={!status ? "page" : undefined} className={chipLink}>Wszystkie</Link>
          </li>
          {ADOPTION_STATUSES.map((s) => (
            <li key={s}>
              <Link href={href({ status: s })} aria-current={s === status ? "page" : undefined} className={chipLink}>
                {ADOPTION_STATUS_LABELS[s]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form action="/panel/adopcje" className="flex flex-wrap items-end gap-3">
        {status && <input type="hidden" name="status" value={status} />}
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
        {status ? ADOPTION_STATUS_LABELS[status] : "Wszystkie"}
        {sourceTitle && <> · „{sourceTitle}”</>}: <strong>{total}</strong> {plural(total, "adopcja", "adopcje", "adopcji")}
        {pages > 1 && `, strona ${page} z ${pages}`}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">Nie ma tu żadnych adopcji.</p>
      ) : (
        <div role="region" aria-labelledby="tabela-adopcji" tabIndex={0} className="relative overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <caption id="tabela-adopcji" className="sr-only">Zgłoszenia i oceny przeniesień (tabela przewija się w poziomie)</caption>
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className={cellHead}>Co przenoszą</th>
                <th scope="col" className={cellHead}>Gmina</th>
                <th scope="col" className={cellHead}>Status</th>
                <th scope="col" className={cellHead}>Instytucja</th>
                <th scope="col" className={cellHead}>Planowany termin</th>
                <th scope="col" className={cellHead}>Zgłoszono</th>
                <th scope="col" className={cellHead}>Ocena</th>
                <th scope="col" className={cellHead}>Co działa</th>
                <th scope="col" className={cellHead}>Propozycje usprawnień</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => <AdoptionItem key={t.id} adoption={t} />)}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Strony" className="flex flex-wrap gap-6 text-lg">
          {page > 1 && <Link href={href({ status, strona: page - 1 })} className={`font-bold ${linkClass}`}>Nowsze</Link>}
          {page < pages && <Link href={href({ status, strona: page + 1 })} className={`font-bold ${linkClass}`}>Starsze</Link>}
        </nav>
      )}
    </section>
  );
}

const missing = <span className="text-muted-foreground">brak</span>;

/** Wiersz tabeli adopcji: dane z /wyprobuj i formularz statusu (ślad w audit_log). */
function AdoptionItem({ adoption: t }: { adoption: AdoptionRow }) {
  const { title, href } = adoptionSource(t);
  const where = t.municipalities?.name ?? "gmina nieznana";
  return (
    <tr className="border-b border-border">
      <th scope="row" className={`${cell} min-w-[20ch] text-left font-normal`}>
        {href ? <Link href={href} className={linkClass}>{title}</Link> : title}
        {t.synthetic && <> <strong>(przykład)</strong></>}
      </th>
      <td className={cell}>{t.municipalities ? <>{t.municipalities.name}<br /><span className="text-muted-foreground">powiat {t.municipalities.county}</span></> : missing}</td>
      <td className={`${cell} min-w-[14rem]`}>
        <ActionForm action={updateAdoptionStatus} className="grid gap-2">
          <input type="hidden" name="adoptionId" value={t.id} />
          <label className="grid gap-1">
            <span className="sr-only">Status przeniesienia „{title}”, {where}</span>
            <select name="status" defaultValue={t.status} className={selectClass}>
              {!ADOPTION_STATUSES.includes(t.status as AdoptionStatus) && <option value={t.status} disabled>{adoptionStatusLabel(t.status)}</option>}
              {ADOPTION_STATUSES.map((s) => <option key={s} value={s}>{ADOPTION_STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <SubmitButton variant="outline" size="sm" aria-label={`Zapisz status przeniesienia „${title}”, ${where}`}>Zapisz status</SubmitButton>
        </ActionForm>
      </td>
      <td className={`${cell} min-w-[16ch]`}>{t.adopter_org ?? missing}</td>
      <td className={`${cell} whitespace-nowrap`}>{t.planned_for ? formatDate(t.planned_for) : missing}</td>
      <td className={`${cell} whitespace-nowrap`}>{formatDate(t.created_at)}</td>
      <td className={`${cell} whitespace-nowrap`}>{t.rating != null ? <><strong>{t.rating}</strong> na 5</> : missing}</td>
      <td className={textCell}>{t.worked ?? missing}</td>
      <td className={textCell}>{t.improve ?? missing}</td>
    </tr>
  );
}
