import { ArrowDownTrayIcon, DocumentDuplicateIcon, EyeIcon, ShieldExclamationIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { DomainBadge } from "@/components/taxonomy/icons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { viewerClient } from "@/lib/auth";
import { requireStaff } from "@/lib/panel/access";
import { PANEL_FILTERS as FILTERS } from "@/lib/panel/filters";
import { statusLabel } from "@/lib/initiatives/status";
import { getClusters } from "@/lib/knowledge/clusters";
import { effectiveSignal, INITIATIVE_COLUMNS, initiativeTriage, type InitiativeRow, type Triage } from "@/lib/panel/initiatives";
import { anonymize } from "@/lib/pii";
import { formatDate, plural } from "@/lib/pl";
import { institutionLabel, signalLevel } from "@/lib/taxonomy";
import type { ThreadWaiting } from "@/lib/thread-types";
import { WaitingBadge, waitingOrEmpty } from "./waiting";
import { panelTitle } from "@/lib/brand";
import { submissionLabel } from "@/lib/panel/initiatives";

export const metadata = { title: panelTitle() };

const PAGE_SIZE = 25;


const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";
const chipLink =
  "inline-flex min-h-12 items-center rounded-full border border-border-strong px-4 text-base hover:border-foreground aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:font-bold aria-[current=page]:text-background";

/** Radar zespołu: zgłoszenia i wskazania od najsilniejszego sygnału, z podpowiedziami (duplikaty, mentor). */
export default async function Page(props: PageProps<"/panel">) {
  const { viewer, scope } = await requireStaff();
  const params = await props.searchParams;
  // Grupa podobnych inicjatyw z /panel/trendy: domyślnie wszystkie statusy, bo grupa obejmuje też zamknięte.
  const groupKey = typeof params.grupa === "string" && /^[0-9a-f]{10}$/.test(params.grupa) ? params.grupa : null;
  const group = groupKey ? (await getClusters()).clusters.find((c) => c.key === groupKey) ?? null : null;
  const filter = FILTERS.find((f) => f.key === params.status) ?? (groupKey ? FILTERS.find((f) => f.key === "wszystkie")! : FILTERS[0]);
  const page = Math.max(1, Number(params.strona) || 1);

  // Odczyt sesją użytkownika: RLS (is_admin) pilnuje dostępu drugi raz (konto testowe: service role, lib/auth.ts).
  const supabase = await viewerClient(viewer);
  // Opiekun instytucji dostaje tylko jej innowacje: RLS (0010) i filtr w zapytaniu, bo konto testowe omija RLS.
  const base = supabase.from("initiatives").select(INITIATIVE_COLUMNS, { count: "exact" });
  let query = (scope.kind === "all" ? base : base.eq("institution_id", scope.institutionId));
  query = (filter.merged ? query.not("duplicate_of", "is", null) : query.is("duplicate_of", null))
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
      <h1 className="text-3xl font-bold">Radar{scope.kind === "institution" && ": innowacje Twojej instytucji"}</h1>
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

      <p>
        <a href={`/panel/eksport?status=${filter.key}`} download className={`inline-flex min-h-12 items-center gap-2 ${linkClass}`}>
          <ArrowDownTrayIcon aria-hidden className="size-5" /> Pobierz listę jako CSV<span className="sr-only"> ({filter.label})</span>
        </a>
      </p>

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
        {" · "}{submissionLabel(n.submission_kind)}
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
