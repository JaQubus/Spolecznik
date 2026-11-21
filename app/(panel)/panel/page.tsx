import { DocumentDuplicateIcon, EyeIcon, ShieldExclamationIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { DomainBadge } from "@/components/taxonomy/icons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireAdmin, viewerClient } from "@/lib/auth";
import { statusLabel, type InitiativeStatus } from "@/lib/initiatives/status";
import { getClusters } from "@/lib/knowledge/clusters";
import { effectiveSignal, INITIATIVE_COLUMNS, initiativeTriage, type InitiativeRow, type Triage } from "@/lib/panel/initiatives";
import { anonymize } from "@/lib/pii";
import { formatDate, plural } from "@/lib/pl";
import { institutionLabel, signalLevel } from "@/lib/taxonomy";
import type { ThreadWaiting } from "@/lib/thread-types";
import { WaitingBadge, waitingOrEmpty } from "./waiting";
import { panelTitle } from "@/lib/brand";

export const metadata = { title: panelTitle() };

const PAGE_SIZE = 25;

const FILTERS: { key: string; label: string; statuses: InitiativeStatus[] | null; waiting?: true }[] = [
  { key: "nowe", label: "Do przejrzenia", statuses: ["submitted"] },
  // Rozmowy, w których asystent przekazał pytanie albo jego odpowiedź nie pomogła.
  { key: "czeka", label: "Czekają na człowieka", statuses: null, waiting: true },
  { key: "w_analizie", label: "W analizie", statuses: ["in_review"] },
  { key: "wyroznione", label: "Wyróżnione", statuses: ["featured"] },
  { key: "wsparcie", label: "Ze wsparciem", statuses: ["supported"] },
  { key: "przenoszone", label: "Przenoszone dalej", statuses: ["scaling"] },
  { key: "zamkniete", label: "Zamknięte", statuses: ["archived"] },
  { key: "wszystkie", label: "Wszystkie", statuses: null },
];

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";
const chipLink =
  "inline-flex min-h-12 items-center rounded-full border border-border-strong px-4 text-base hover:border-foreground aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:font-bold aria-[current=page]:text-background";

/** Radar zespołu: zgłoszenia i wskazania od najsilniejszego sygnału, z podpowiedziami (duplikaty, mentor). */
export default async function Page(props: PageProps<"/panel">) {
  const viewer = await requireAdmin();
  const params = await props.searchParams;
  // Grupa podobnych inicjatyw z /panel/trendy: domyślnie wszystkie statusy, bo grupa obejmuje też zamknięte.
  const groupKey = typeof params.grupa === "string" && /^[0-9a-f]{10}$/.test(params.grupa) ? params.grupa : null;
  const group = groupKey ? (await getClusters()).clusters.find((c) => c.key === groupKey) ?? null : null;
  const filter = FILTERS.find((f) => f.key === params.status) ?? (groupKey ? FILTERS.at(-1)! : FILTERS[0]);
  const page = Math.max(1, Number(params.strona) || 1);

  // Odczyt sesją użytkownika: RLS (is_admin) pilnuje dostępu drugi raz (konto testowe: service role, lib/auth.ts).
  const supabase = await viewerClient(viewer);
  let query = supabase
    .from("initiatives")
    .select(INITIATIVE_COLUMNS, { count: "exact" })
    .is("duplicate_of", null)
    .order("signal", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (filter.statuses) query = query.in("status", filter.statuses);
  if (groupKey) query = query.in("id", group?.ids ?? []);
  if (filter.waiting) query = query.in("id", [...(await waitingOrEmpty()).keys()]);
  const { data, count, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as InitiativeRow[];
  const [triage, waiting] = await Promise.all([initiativeTriage(rows), waitingOrEmpty(rows.map((n) => n.id))]);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const groupParam = groupKey ? `&grupa=${groupKey}` : "";
  const href = (p: number) => `/panel?status=${filter.key}${groupParam}${p > 1 ? `&strona=${p}` : ""}`;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Radar</h1>
      {params.usunieto === "inicjatywa" && <Alert tone="success" title="Usunięto inicjatywę" />}
      {groupKey && (
        <p className="text-lg">
          {group
            ? <>Grupa podobnych inicjatyw: <strong>{group.label ?? group.keywords.join(", ")}</strong>. </>
            : "Tej grupy już nie ma: inicjatywy zmieniły się od wejścia na Trendy. "}
          <Link href={`/panel?status=${filter.key}`} className={linkClass}>Pokaż wszystkie</Link>
          {" · "}
          <Link href="/panel/trendy#grupy" className={linkClass}>Wróć do grup</Link>
        </p>
      )}

      <nav aria-label="Filtruj inicjatywy">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <li key={f.key}>
              <Link href={`/panel?status=${f.key}${groupParam}`} aria-current={f.key === filter.key ? "page" : undefined} className={chipLink}>
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="text-lg">
        {filter.label}: <strong>{total}</strong> {plural(total, "inicjatywa", "inicjatywy", "inicjatyw")}
        {pages > 1 && `, strona ${page} z ${pages}`}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">Nie ma tu żadnych inicjatyw.</p>
      ) : (
        <ol className="max-w-4xl border-t">
          {rows.map((n) => <InitiativeItem key={n.id} row={n} triage={triage.get(n.id)} waiting={waiting.get(n.id) ?? null} />)}
        </ol>
      )}

      {pages > 1 && (
        <nav aria-label="Strony" className="flex flex-wrap gap-6 text-lg">
          {page > 1 && <Link href={href(page - 1)} className={`font-bold ${linkClass}`}>Poprzednia strona</Link>}
          {page < pages && <Link href={href(page + 1)} className={`inline-flex min-h-12 items-center font-bold ${linkClass}`}>Następna strona</Link>}
        </nav>
      )}
    </section>
  );
}

/** Wiersz listy (jak ResultList): bez ramek, linie między wierszami, analiza jako etykiety ze słowami. */
function InitiativeItem({ row: n, triage, waiting }: { row: InitiativeRow; triage?: Triage; waiting: ThreadWaiting }) {
  const pii = !!n.raw_text && anonymize(n.raw_text).found;
  const dups = triage?.duplicates.length ?? 0;
  const signal = effectiveSignal(n);
  return (
    <li className="grid gap-2 border-b py-6">
      <h2 className="text-xl font-bold">
        <Link href={`/panel/inicjatywy/${n.id}`} className={linkClass}>{n.title}</Link>
      </h2>
      <p className="max-w-[68ch]">{n.summary}</p>
      <p className="text-base text-muted-foreground">
        <span className="font-mono tracking-wider">{n.status_code}</span>
        {" · "}{n.submission_kind === "nomination" ? "wskazanie" : "zgłoszenie"}
        {" · "}{n.municipalities ? `${n.municipalities.name}, powiat ${n.municipalities.county}` : "gmina nieznana"}
        {n.institution_type && ` · ${institutionLabel(n.institution_type)}`}
        {" · "}{formatDate(n.created_at)}
        {" · "}<strong className="text-foreground">{statusLabel(n.status)}</strong>
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Analiza inicjatywy">
        {signal != null && <li><Badge>Sygnał {signal}/100: {signalLevel(signal).label}{n.signal_override != null && " (korekta)"}</Badge></li>}
        <WaitingBadge waiting={waiting} />
        {n.published && <li><Badge variant="outline"><EyeIcon aria-hidden className="size-4" /> Opublikowana</Badge></li>}
        {n.domains.slice(0, 3).map((d) => <li key={d}><DomainBadge domain={d} /></li>)}
        {n.nominations_count > 1 && <li><Badge variant="outline">Wskazania: {n.nominations_count}</Badge></li>}
        {pii && <li><Badge variant="warning"><ShieldExclamationIcon aria-hidden className="size-4" /> Może zawierać dane osobowe</Badge></li>}
        {dups > 0 && <li><Badge variant="warning"><DocumentDuplicateIcon aria-hidden className="size-4" /> Możliwy duplikat ({dups})</Badge></li>}
      </ul>
      {triage?.mentorName && <p className="text-base">Sugerowany mentor: <strong>{triage.mentorName}</strong></p>}
    </li>
  );
}
