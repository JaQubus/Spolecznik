import { isAdmin } from "@/lib/auth";
import { getTrends, parseBucket } from "@/lib/knowledge/trends";
import { AREA_LABELS } from "@/lib/taxonomy";

// Średnik i BOM: polski Excel otwiera taki plik poprawnie (przecinek to separator dziesiętny).
const cell = (v: string | number) => {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: (string | number)[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";

/** Eksport CSV trendów — tylko admin (sprawdzane tutaj, nie tylko przez ukrycie przycisku). */
export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Brak dostępu", { status: 403 });
  const bucket = parseBucket(new URL(request.url).searchParams.get("okres"));
  const t = await getTrends(bucket);
  const rows: (string | number)[][] = [
    ["Zestaw", "Okres / powiat / słowo", "Obszar", "Liczba", "Poprzednie 30 dni"],
    ...t.series
      .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.area.localeCompare(b.area))
      .map((s) => [bucket === "month" ? "obszar_miesiac" : "obszar_tydzien", s.bucket, AREA_LABELS[s.area], s.needs, ""]),
    ...t.byPowiat.map((p) => ["powiat", p.powiat, "", p.needs, ""]),
    ...t.keywords.map((k) => ["slowo_30_dni", k.keyword, "", k.recent, k.previous]),
  ];
  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trendy-potrzeb-${bucket}-${t.asOf}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
