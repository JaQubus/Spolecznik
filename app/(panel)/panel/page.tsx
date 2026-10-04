import { DocumentDuplicateIcon, ShieldExclamationIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireAdmin, viewerClient } from "@/lib/auth";
import { getClusters } from "@/lib/knowledge/clusters";
import { NEED_STATUS_LABELS, type NeedStatus } from "@/lib/need-status";
import { NEED_COLUMNS, needTriage, type NeedRow, type Triage } from "@/lib/panel/needs";
import { formatDate, plural } from "@/lib/pl";
import { anonymize } from "@/lib/pii";
import { AREA_LABELS } from "@/lib/taxonomy";

export const metadata = { title: "Panel ROPS" };

const PAGE_SIZE = 25;

const FILTERS: { key: string; label: string; statuses: NeedStatus[] | null }[] = [
  { key: "nowe", label: "Do przejrzenia", statuses: ["zgloszone", "luka"] },
  { key: "luka", label: "Luki", statuses: ["luka"] },
  { key: "w_analizie", label: "W analizie", statuses: ["w_analizie"] },
  { key: "ekspert", label: "Przypisano eksperta", statuses: ["ekspert"] },
  { key: "odpowiedz", label: "Odpowiedź", statuses: ["odpowiedz"] },
  { key: "zamkniete", label: "Zamknięte", statuses: ["zamkniete"] },
  { key: "wszystkie", label: "Wszystkie", statuses: null },
];

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";
const chipLink =
  "inline-flex min-h-12 items-center rounded-full border border-border-strong px-4 text-base hover:border-foreground aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:font-bold aria-[current=page]:text-background";

export default async function Page(props: PageProps<"/panel">) {
  const viewer = await requireAdmin();
  const params = await props.searchParams;
  // Grupa podobnych zgłoszeń z /panel/trendy: domyślnie wszystkie statusy, bo grupa obejmuje też zamknięte.
  const groupKey = typeof params.grupa === "string" && /^[0-9a-f]{10}$/.test(params.grupa) ? params.grupa : null;
  const group = groupKey ? (await getClusters()).clusters.find((c) => c.key === groupKey) ?? null : null;
  const filter = FILTERS.find((f) => f.key === params.status) ?? (groupKey ? FILTERS.at(-1)! : FILTERS[0]);
  const page = Math.max(1, Number(params.strona) || 1);

  // Odczyt sesją użytkownika: RLS (is_admin) pilnuje dostępu drugi raz (konto testowe: service role, lib/auth.ts).
  const supabase = await viewerClient(viewer);
  let query = supabase
    .from("needs")
    .select(NEED_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (filter.statuses) query = query.in("status", filter.statuses);
  if (groupKey) query = query.in("id", group?.ids ?? []);
  const { data, count, error } = await query;
  if (error) throw error;

  const needs = (data ?? []) as unknown as NeedRow[];
  const triage = await needTriage(needs);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const groupParam = groupKey ? `&grupa=${groupKey}` : "";
  const href = (p: number) => `/panel?status=${filter.key}${groupParam}${p > 1 ? `&strona=${p}` : ""}`;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Zgłoszenia</h1>
      {params.usunieto === "need" && <Alert tone="success" title="Usunięto zgłoszenie" />}
      {groupKey && (
        <p className="text-lg">
          {group
            ? <>Grupa podobnych zgłoszeń: <strong>{group.label ?? group.keywords.join(", ")}</strong>. </>
            : "Tej grupy już nie ma: zgłoszenia zmieniły się od wejścia na Trendy. "}
          <Link href={`/panel?status=${filter.key}`} className={linkClass}>Pokaż wszystkie zgłoszenia</Link>
          {" · "}
          <Link href="/panel/trendy#grupy" className={linkClass}>Wróć do grup</Link>
        </p>
      )}

      <nav aria-label="Filtruj zgłoszenia">
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
        {filter.label}: <strong>{total}</strong> {plural(total, "zgłoszenie", "zgłoszenia", "zgłoszeń")}
        {pages > 1 && `, strona ${page} z ${pages}`}
      </p>

      {needs.length === 0 ? (
        <p className="text-muted-foreground">Nie ma tu żadnych zgłoszeń.</p>
      ) : (
        <ol className="max-w-4xl border-t">
          {needs.map((n) => <NeedItem key={n.id} need={n} triage={triage.get(n.id)} />)}
        </ol>
      )}

      {pages > 1 && (
        <nav aria-label="Strony" className="flex flex-wrap gap-6 text-lg">
          {page > 1 && <Link href={href(page - 1)} className={`font-bold ${linkClass}`}>Nowsze zgłoszenia</Link>}
          {page < pages && <Link href={href(page + 1)} className={`font-bold ${linkClass}`}>Starsze zgłoszenia</Link>}
        </nav>
      )}
    </section>
  );
}

/** Wiersz skrzynki (jak ResultList): bez ramek, linie między wierszami, analiza AI jako etykiety ze słowami. */
function NeedItem({ need: n, triage }: { need: NeedRow; triage?: Triage }) {
  const pii = !!n.raw_text && anonymize(n.raw_text).found;
  const dups = triage?.duplicates.length ?? 0;
  return (
    <li className="grid gap-2 border-b py-6">
      <h2 className="text-xl font-bold">
        <Link href={`/panel/zgloszenia/${n.id}`} className={linkClass}>{n.card.summary}</Link>
      </h2>
      <p className="text-base text-muted-foreground">
        <span className="font-mono tracking-wider">{n.status_code}</span>
        {" · "}{n.gminy ? `${n.gminy.nazwa}, powiat ${n.gminy.powiat}` : "gmina nieznana"}
        {" · "}{formatDate(n.created_at)}
        {" · "}<strong className="text-foreground">{NEED_STATUS_LABELS[n.status]}</strong>
        {n.best_fit != null && ` · najlepsze dopasowanie ${n.best_fit} na 100`}
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Analiza zgłoszenia">
        {n.card.areas.slice(0, 3).map((a) => <li key={a}><Badge>{AREA_LABELS[a]}</Badge></li>)}
        {pii && <li><Badge variant="outline"><ShieldExclamationIcon aria-hidden className="size-4" /> Może zawierać dane osobowe</Badge></li>}
        {dups > 0 && <li><Badge variant="outline"><DocumentDuplicateIcon aria-hidden className="size-4" /> Możliwy duplikat ({dups})</Badge></li>}
      </ul>
      {triage?.expertName && <p className="text-base">Sugerowany ekspert: <strong>{triage.expertName}</strong></p>}
    </li>
  );
}
