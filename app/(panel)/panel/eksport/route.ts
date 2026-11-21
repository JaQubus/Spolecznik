import { statusLabel } from "@/lib/initiatives/status";
import { staffScope } from "@/lib/panel/access";
import { exportCsv, type ExportRow } from "@/lib/panel/export";
import { PANEL_FILTERS } from "@/lib/panel/filters";
import { createAdminClient } from "@/lib/supabase/admin";

const COLUMNS =
  "status_code, title, status, funnel_stage, innovation_kind, sectors, trl, ip_status, signal, signal_override, published, duplicate_of, synthetic, " +
  "created_at, updated_at, institutions(name), municipalities(name, county)";

type Row = Omit<ExportRow, "institution_name" | "municipality" | "county" | "partner_name" | "duplicate_code"> & {
  duplicate_of: string | null;
  institutions: { name: string } | null;
  municipalities: { name: string; county: string } | null;
  partners?: { name: string } | null;
};

/**
 * Eksport CSV listy innowacji z Panelu (te same filtry co lista: ?status=). Zespół PCI dostaje wszystko,
 * opiekun instytucji tylko jej innowacje — zakres sprawdzamy tutaj, nie przez ukrycie linku. Wpis w historii
 * nie powstaje: eksport nie zawiera treści zgłoszeń ani danych kontaktowych, tylko pola karty i ocenę.
 */
export async function GET(request: Request) {
  const scope = await staffScope();
  if (!scope) return new Response("Brak dostępu", { status: 403 });
  const filter = PANEL_FILTERS.find((f) => f.key === new URL(request.url).searchParams.get("status")) ?? PANEL_FILTERS.find((f) => f.key === "wszystkie")!;

  const supabase = createAdminClient();
  const build = (columns: string) => {
    const scoped = supabase.from("initiatives").select(columns);
    const q = (scope.kind === "all" ? scoped : scoped.eq("institution_id", scope.institutionId))
      .order("created_at", { ascending: false }).limit(5000);
    const merged = filter.merged ? q.not("duplicate_of", "is", null) : q.is("duplicate_of", null);
    return filter.statuses ? merged.in("status", filter.statuses) : merged;
  };
  // Baza sprzed 0009/0010 nie ma funnel_stage i assigned_partner: eksport działa wtedy bez tych kolumn.
  let res = await build(`${COLUMNS}, partners:assigned_partner(name)`);
  if (res.error) res = await build(COLUMNS.replace("funnel_stage, ", ""));
  if (res.error) {
    console.error("[panel] eksport:", res.error);
    return new Response("Nie udało się przygotować pliku", { status: 500 });
  }
  const data = res.data as unknown as Row[];

  const mergedIds = [...new Set(data.map((r) => r.duplicate_of).filter((x): x is string => !!x))];
  const codes = new Map<string, string>();
  if (mergedIds.length) {
    const { data: targets, error } = await supabase.from("initiatives").select("id, status_code").in("id", mergedIds);
    if (error) console.error("[panel] eksport, kody scalonych:", error);
    for (const t of targets ?? []) codes.set(t.id as string, t.status_code as string);
  }

  const rows: ExportRow[] = data.map((r) => ({
    ...r,
    funnel_stage: r.funnel_stage ?? null,
    institution_name: r.institutions?.name ?? null,
    municipality: r.municipalities?.name ?? null,
    county: r.municipalities?.county ?? null,
    partner_name: r.partners?.name ?? null,
    duplicate_code: r.duplicate_of ? codes.get(r.duplicate_of) ?? null : null,
  }));
  const day = new Date().toISOString().slice(0, 10);
  return new Response(exportCsv(rows, statusLabel), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="innowacje-${filter.key}-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
