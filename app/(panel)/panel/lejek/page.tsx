import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { panelTitle } from "@/lib/brand";
import { recentFunnelEvents, loadFunnelItems, type FunnelEvent } from "@/lib/panel/funnel-data";
import { groupByStage, laterStages, type FunnelColumn, type FunnelItem } from "@/lib/panel/funnel-board";
import { requireStaff } from "@/lib/panel/access";
import { formatDate, plural } from "@/lib/pl";
import { FUNNEL, FUNNEL_KEYS, funnelLabel, signalLevel, type FunnelKey } from "@/lib/taxonomy";
import { ActionForm, SubmitButton } from "../action-form";
import { moveFunnelStage } from "../radar-actions";

export const metadata = { title: panelTitle("Lejek") };

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";
const SHOWN = 5;
const SOURCE: Record<string, string> = { system: "system", author: "twórca", panel: "zespół" };

/**
 * Lejek PCI (zadanie, sekcja 9): co dzieje się z innowacją po identyfikacji.
 * wykryta → zweryfikowana → oceniona → skierowana → w realizacji → wdrożona / skomercjalizowana / zarchiwizowana.
 * Zespół przesuwa innowację do przodu z notatką; opiekun instytucji widzi swoje innowacje bez przycisków.
 */
export default async function Page(props: PageProps<"/panel/lejek">) {
  const { viewer, scope } = await requireStaff("/panel/lejek");
  const params = await props.searchParams;
  const only = FUNNEL_KEYS.find((k) => k === params.etap) ?? null;
  const canMove = viewer.role === "admin";

  let columns: FunnelColumn[] = [];
  let events: FunnelEvent[] = [];
  let error = false;
  let titles = new Map<string, FunnelItem>();
  try {
    const items = await loadFunnelItems(scope);
    columns = groupByStage(items);
    titles = new Map(items.map((i) => [i.id, i]));
    events = await recentFunnelEvents(items.map((i) => i.id));
  } catch (e) {
    console.error("[panel] lejek:", e);
    error = true;
  }
  const total = columns.reduce((n, c) => n + c.items.length, 0);

  return (
    <section className="max-w-5xl space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Lejek</h1>
        <p className="max-w-[68ch] text-lg">
          Co dzieje się z innowacją po jej zidentyfikowaniu. Innowacja idzie tylko do przodu, a każde przejście zostaje w historii.
          {scope.kind === "institution" && " Widzisz innowacje swojej instytucji."}
        </p>
      </div>

      {error && <Alert tone="warning" title="Nie udało się wczytać lejka">Sprawdź, czy w bazie jest migracja 0009_pathways.sql, i spróbuj ponownie.</Alert>}

      <nav aria-label="Etapy lejka">
        <ol className="flex flex-wrap gap-2">
          {columns.map((c) => (
            <li key={c.stage}>
              <Link
                href={only === c.stage ? "/panel/lejek" : `/panel/lejek?etap=${c.stage}#etap-${c.stage}`}
                aria-current={only === c.stage ? "page" : undefined}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border-strong px-4 text-base hover:border-foreground aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:font-bold aria-[current=page]:text-background"
              >
                {FUNNEL[c.stage].label}: <strong>{c.items.length}</strong>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <p className="text-lg">Razem: <strong>{total}</strong> {plural(total, "innowacja", "innowacje", "innowacji")}.</p>

      {columns.filter((c) => !only || c.stage === only).map((c) => (
        <StageSection key={c.stage} column={c} all={only === c.stage} canMove={canMove} />
      ))}

      <section aria-labelledby="historia" className="space-y-3">
        <h2 id="historia" className="text-2xl font-bold">Ostatnie przejścia</h2>
        {events.length === 0 ? (
          <p className="text-muted-foreground">Nic jeszcze nie zostało zapisane.</p>
        ) : (
          <ol className="border-t">
            {events.map((e) => {
              const item = titles.get(e.initiative_id);
              return (
                <li key={e.id} className="border-b py-3">
                  <span className="text-muted-foreground">{formatDate(e.created_at)}</span> ·{" "}
                  {item ? <Link href={`/panel/inicjatywy/${item.id}`} className={linkClass}>{item.title}</Link> : "Innowacja"}: <strong>{funnelLabel(e.stage)}</strong>
                  <span className="text-muted-foreground"> ({SOURCE[e.source] ?? e.source})</span>
                  {e.note && <> — „{e.note}”</>}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </section>
  );
}

function StageSection({ column: c, all, canMove }: { column: FunnelColumn; all: boolean; canMove: boolean }) {
  const shown = all ? c.items : c.items.slice(0, SHOWN);
  const rest = c.items.length - shown.length;
  const info = FUNNEL[c.stage as FunnelKey];
  return (
    <section id={`etap-${c.stage}`} aria-labelledby={`h-${c.stage}`} className="scroll-mt-6 space-y-3">
      <h2 id={`h-${c.stage}`} className="text-2xl font-bold">{info.label} <span className="font-normal text-muted-foreground">({c.items.length})</span></h2>
      <p className="max-w-[68ch] text-muted-foreground">{info.description}</p>
      {c.items.length === 0 ? (
        <p className="text-muted-foreground">Nie ma tu żadnych innowacji.</p>
      ) : (
        <ol className="max-w-4xl border-t">
          {shown.map((i) => (
            <li key={i.id} className="grid gap-2 border-b py-4">
              <p className="text-lg font-bold"><Link href={`/panel/inicjatywy/${i.id}`} className={linkClass}>{i.title}</Link></p>
              <p className="text-base text-muted-foreground">
                <span className="font-mono tracking-wider">{i.status_code}</span>
                {i.institution_name && ` · ${i.institution_name}`}
                {` · zmieniona ${formatDate(i.updated_at)}`}
              </p>
              <p className="flex flex-wrap gap-2">
                {i.signal != null && <Badge>Sygnał {i.signal}/100: {signalLevel(i.signal).label}</Badge>}
                {i.partner_name && <Badge variant="outline">Partner: {i.partner_name}</Badge>}
              </p>
              {canMove && laterStages(i.funnel_stage).length > 0 && (
                <details className="max-w-xl">
                  <summary className="inline-flex min-h-12 cursor-pointer items-center text-base underline decoration-1 underline-offset-4 hover:decoration-2">
                    Przesuń dalej<span className="sr-only">: {i.title}</span>
                  </summary>
                  <ActionForm action={moveFunnelStage} className="space-y-3 pt-2">
                    <input type="hidden" name="initiativeId" value={i.id} />
                    <div className="space-y-2">
                      <Label htmlFor={`stage-${i.id}`}>Nowy etap</Label>
                      <NativeSelect id={`stage-${i.id}`} name="stage" defaultValue={laterStages(i.funnel_stage)[0]}>
                        {laterStages(i.funnel_stage).map((s) => <option key={s} value={s}>{funnelLabel(s)}</option>)}
                      </NativeSelect>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`note-${i.id}`}>Notatka (nieobowiązkowa)</Label>
                      <Input id={`note-${i.id}`} name="note" maxLength={500} />
                    </div>
                    <SubmitButton variant="outline" size="sm" aria-label={`Przesuń: ${i.title}`}>Przesuń</SubmitButton>
                  </ActionForm>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
      {rest > 0 && (
        <p><Link href={`/panel/lejek?etap=${c.stage}#etap-${c.stage}`} className={`inline-flex min-h-12 items-center ${linkClass}`}>Pokaż jeszcze {rest}</Link></p>
      )}
    </section>
  );
}
