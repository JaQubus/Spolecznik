import "server-only";
import gminyJson from "@/data/out/gminy.json";
import { DOMAIN_KEYS, type DomainKey } from "@/lib/taxonomy";
import { demoData, hasDatabase, type DemoInitiative } from "./demo-data";

export type Bucket = "week" | "month";
export type TrendPoint = { bucket: string; domain: DomainKey; initiatives: number };
export type Trends = {
  bucket: Bucket;
  periods: string[];             // początki okresów (YYYY-MM-DD), rosnąco
  series: TrendPoint[];
  byCounty: { county: string; initiatives: number; published: number; avgSignal: number | null }[];
  keywords: { keyword: string; recent: number; previous: number }[];
  total: number;
  /** Do kiedy liczymy „ostatnie 30 dni” (w trybie plików: data najnowszej inicjatywy). */
  asOf: string;
  source: "baza" | "pliki";
  synthetic: boolean;
};

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const isDomain = (d: string): d is DomainKey => (DOMAIN_KEYS as readonly string[]).includes(d);

function bucketStart(d: Date, bucket: Bucket): string {
  if (bucket === "month") return `${d.toISOString().slice(0, 7)}-01`;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return isoDay(monday);
}

/** Wszystkie okresy od pierwszego do ostatniego — także puste, żeby oś czasu nie miała dziur. */
function fillPeriods(present: string[], bucket: Bucket): string[] {
  if (!present.length) return [];
  const sorted = [...present].sort();
  const out: string[] = [];
  const cur = new Date(`${sorted[0]}T00:00:00Z`);
  const end = sorted.at(-1)!;
  while (isoDay(cur) <= end) {
    out.push(isoDay(cur));
    if (bucket === "month") cur.setUTCMonth(cur.getUTCMonth() + 1);
    else cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return out;
}

const COUNTY = new Map(gminyJson.map((g) => [g.teryt, g.powiat]));

/** Agregacja w pamięci (tryb bez bazy) — te same reguły co funkcje SQL z 0005_analytics.sql. */
function aggregate(rows: DemoInitiative[], bucket: Bucket, asOf: Date): Omit<Trends, "source"> {
  const counts = new Map<string, number>();
  const counties = new Map<string, { initiatives: number; published: number }>();
  const recent = new Map<string, number>();
  const previous = new Map<string, number>();
  for (const n of rows) {
    const d = new Date(n.created_at);
    const b = bucketStart(d, bucket);
    for (const domain of n.domains.filter(isDomain)) counts.set(`${b}|${domain}`, (counts.get(`${b}|${domain}`) ?? 0) + 1);
    const county = (n.teryt && COUNTY.get(n.teryt)) || "nie podano";
    const c = counties.get(county) ?? { initiatives: 0, published: 0 };
    c.initiatives += 1;
    if (n.published) c.published += 1;
    counties.set(county, c);
    const age = (asOf.getTime() - d.getTime()) / DAY;
    for (const k of n.card.keywords ?? []) {
      const key = k.toLowerCase();
      if (age >= 0 && age < 30) recent.set(key, (recent.get(key) ?? 0) + 1);
      else if (age >= 30 && age < 60) previous.set(key, (previous.get(key) ?? 0) + 1);
    }
  }
  const series = [...counts].map(([k, initiatives]) => {
    const [bucketKey, domain] = k.split("|");
    return { bucket: bucketKey, domain: domain as DomainKey, initiatives };
  });
  const keywords = [...new Set([...recent.keys(), ...previous.keys()])]
    .map((keyword) => ({ keyword, recent: recent.get(keyword) ?? 0, previous: previous.get(keyword) ?? 0 }))
    .sort((a, b) => b.recent - b.previous - (a.recent - a.previous) || b.recent - a.recent)
    .slice(0, 15);
  return {
    bucket,
    periods: fillPeriods(series.map((s) => s.bucket), bucket),
    series,
    byCounty: [...counties].map(([county, c]) => ({ county, ...c, avgSignal: null })).sort((a, b) => b.initiatives - a.initiatives),
    keywords,
    total: rows.length,
    asOf: isoDay(asOf),
    synthetic: rows.length > 0,
  };
}

async function fromFiles(bucket: Bucket): Promise<Trends> {
  const { initiatives } = await demoData();
  const latest = initiatives.reduce((m, n) => (n.created_at > m ? n.created_at : m), "");
  return { ...aggregate(initiatives, bucket, latest ? new Date(latest) : new Date()), source: "pliki" };
}

async function fromDatabase(bucket: Bucket): Promise<Trends> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const [series, counties, keywords, meta] = await Promise.all([
    supabase.rpc("initiative_trends", { p_bucket: bucket }),
    supabase.rpc("initiatives_by_county"),
    supabase.rpc("rising_keywords", { p_days: 30, p_limit: 15 }),
    supabase.from("initiatives").select("synthetic", { count: "exact", head: true }).eq("synthetic", true),
  ]);
  for (const r of [series, counties, keywords]) if (r.error) throw r.error;
  const points: TrendPoint[] = ((series.data ?? []) as TrendPoint[])
    .map((r) => ({ ...r, bucket: String(r.bucket).slice(0, 10) }))
    .filter((p) => isDomain(p.domain));
  const byCounty = ((counties.data ?? []) as { county: string; initiatives: number; published: number; avg_signal: number | null }[])
    .map((c) => ({ county: c.county, initiatives: c.initiatives, published: c.published, avgSignal: c.avg_signal == null ? null : Number(c.avg_signal) }));
  return {
    bucket,
    periods: fillPeriods(points.map((p) => p.bucket), bucket),
    series: points,
    byCounty,
    keywords: keywords.data ?? [],
    total: byCounty.reduce((s, p) => s + p.initiatives, 0),
    asOf: isoDay(new Date()),
    source: "baza",
    synthetic: (meta.count ?? 0) > 0,
  };
}

/** Trendy inicjatyw — tylko dla admina (sprawdza wywołujący: requireAdmin / isAdmin). */
export async function getTrends(bucket: Bucket): Promise<Trends> {
  return hasDatabase() ? fromDatabase(bucket) : fromFiles(bucket);
}

export const parseBucket = (v: unknown): Bucket => (v === "month" ? "month" : "week");
