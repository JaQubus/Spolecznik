import { isAdmin } from "@/lib/auth";
import { getClusters } from "@/lib/knowledge/clusters";
import { gapGminaLabel, getGaps } from "@/lib/knowledge/gaps";
import { getTrends, parseBucket } from "@/lib/knowledge/trends";
import { domainLabel } from "@/lib/taxonomy";

// Średnik i BOM: polski Excel otwiera taki plik poprawnie (przecinek to separator dziesiętny).
const cell = (v: string | number) => {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: (string | number)[][]) => "\ufeff" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";

/** Eksport CSV trendów — tylko admin (sprawdzane tutaj, nie tylko przez ukrycie przycisku). */
export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Brak dostępu", { status: 403 });
  const bucket = parseBucket(new URL(request.url).searchParams.get("okres"));
  const [t, gaps, groups] = await Promise.all([getTrends(bucket), getGaps(), getClusters()]);
  const rows: (string | number)[][] = [
    ["Zestaw", "Okres / powiat / słowo", "Dziedzina", "Liczba", "Poprzednie 30 dni / opublikowane"],
    ...t.series
      .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.domain.localeCompare(b.domain))
      .map((s) => [bucket === "month" ? "dziedzina_miesiac" : "dziedzina_tydzien", s.bucket, domainLabel(s.domain), s.initiatives, ""]),
    ...t.byCounty.map((p) => ["powiat", p.county, "", p.initiatives, p.published]),
    ...t.keywords.map((k) => ["slowo_30_dni", k.keyword, "", k.recent, k.previous]),
    ...Object.entries(gaps.byGmina)
      .sort((a, b) => b[1] - a[1])
      .map(([teryt, n]) => ["luka_gmina", `${gapGminaLabel(teryt)} [${teryt}]`, "", n, ""]),
    ...gaps.directions.map((d) => ["luka_dziedzina", `${d.gminy} gmin`, domainLabel(d.domain), d.challenges, ""]),
    // Grupa bez nazwy z LLM: jej słowa kluczowe. Dziedzina: najczęstsza w grupie.
    ...groups.clusters.map((c) => [
      "grupa",
      `${c.label ?? c.keywords.join(", ")} (${c.gminy} gmin)`,
      c.domains[0] ? domainLabel(c.domains[0]) : "",
      c.ids.length,
      "",
    ]),
  ];
  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trendy-${bucket}-${t.asOf}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
