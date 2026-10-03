import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MWS_AREAS } from "@/lib/schemas";
import type { AreaKey } from "./types";

export type Bucket = "week" | "month";
export type TrendPoint = { bucket: string; area: AreaKey; needs: number };
export type Trends = {
  bucket: Bucket;
  periods: string[];             // początki okresów (YYYY-MM-DD), rosnąco
  series: TrendPoint[];
  byPowiat: { powiat: string; needs: number }[];
  keywords: { keyword: string; recent: number; previous: number }[];
  total: number;
  /** Do kiedy liczymy „ostatnie 30 dni” (w trybie plików: data najnowszego zgłoszenia). */
  asOf: string;
  source: "baza" | "pliki";
  synthetic: boolean;
};

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

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

type NeedRow = { created_at: string; teryt: string | null; card: { areas?: string[]; keywords?: string[] }; synthetic?: boolean };

/** Agregacja w pamięci (tryb bez bazy) — te same reguły co funkcje SQL z migracji 0005. */
function aggregate(needs: NeedRow[], powiatOf: (teryt: string | null) => string, bucket: Bucket, asOf: Date): Omit<Trends, "source"> {
  const counts = new Map<string, number>();
  const powiaty = new Map<string, number>();
  const recent = new Map<string, number>();
  const previous = new Map<string, number>();
  for (const n of needs) {
    const d = new Date(n.created_at);
    const b = bucketStart(d, bucket);
    for (const a of n.card.areas ?? []) counts.set(`${b}|${a}`, (counts.get(`${b}|${a}`) ?? 0) + 1);
    const p = powiatOf(n.teryt);
    powiaty.set(p, (powiaty.get(p) ?? 0) + 1);
    const age = (asOf.getTime() - d.getTime()) / DAY;
    for (const k of n.card.keywords ?? []) {
      const key = k.toLowerCase();
      if (age >= 0 && age < 30) recent.set(key, (recent.get(key) ?? 0) + 1);
      else if (age >= 30 && age < 60) previous.set(key, (previous.get(key) ?? 0) + 1);
    }
  }
  const series = [...counts].map(([k, needs]) => {
    const [bucketKey, area] = k.split("|");
    return { bucket: bucketKey, area: area as AreaKey, needs };
  }).filter((p) => (MWS_AREAS as readonly string[]).includes(p.area));
  const keywords = [...new Set([...recent.keys(), ...previous.keys()])]
    .map((keyword) => ({ keyword, recent: recent.get(keyword) ?? 0, previous: previous.get(keyword) ?? 0 }))
    .sort((a, b) => b.recent - b.previous - (a.recent - a.previous) || b.recent - a.recent)
    .slice(0, 15);
  return {
    bucket,
    periods: fillPeriods(series.map((s) => s.bucket), bucket),
    series,
    byPowiat: [...powiaty].map(([powiat, needs]) => ({ powiat, needs })).sort((a, b) => b.needs - a.needs),
    keywords,
    total: needs.length,
    asOf: isoDay(asOf),
    synthetic: needs.some((n) => n.synthetic),
  };
}

async function fromFiles(bucket: Bucket): Promise<Trends> {
  // Bez bazy: 200 syntetycznych potrzeb z pipeline'u (data/seed_synthetic.py), wyraźnie oznaczonych w UI.
  const dir = path.join(process.cwd(), "data", "out");
  const [synthetic, gminy] = await Promise.all([
    readFile(path.join(dir, "synthetic.json"), "utf8").then(JSON.parse).catch(() => ({ needs: [] })),
    readFile(path.join(dir, "gminy.json"), "utf8").then(JSON.parse).catch(() => []),
  ]);
  const needs: NeedRow[] = synthetic.needs ?? [];
  const powiat = new Map<string, string>((gminy as { teryt: string; powiat: string }[]).map((g) => [g.teryt, g.powiat]));
  const latest = needs.reduce((m, n) => (n.created_at > m ? n.created_at : m), "");
  const asOf = latest ? new Date(latest) : new Date();
  return { ...aggregate(needs, (t) => (t && powiat.get(t)) || "nie podano", bucket, asOf), source: "pliki" };
}

async function fromDatabase(bucket: Bucket): Promise<Trends> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const [series, powiaty, keywords, meta] = await Promise.all([
    supabase.rpc("need_trends", { p_bucket: bucket }),
    supabase.rpc("needs_by_powiat"),
    supabase.rpc("rising_keywords", { p_days: 30, p_limit: 15 }),
    supabase.from("needs").select("synthetic", { count: "exact" }).eq("synthetic", true).limit(1),
  ]);
  for (const r of [series, powiaty, keywords]) if (r.error) throw r.error;
  const points: TrendPoint[] = ((series.data ?? []) as TrendPoint[]).map((r) => ({ ...r, bucket: String(r.bucket).slice(0, 10) }));
  const byPowiat = (powiaty.data ?? []) as { powiat: string; needs: number }[];
  return {
    bucket,
    periods: fillPeriods(points.map((p) => p.bucket), bucket),
    series: points,
    byPowiat,
    keywords: keywords.data ?? [],
    total: byPowiat.reduce((s, p) => s + p.needs, 0),
    asOf: isoDay(new Date()),
    source: "baza",
    synthetic: (meta.count ?? 0) > 0,
  };
}

/** Trendy potrzeb — tylko dla admina (sprawdza wywołujący: requireAdmin / isAdmin). */
export async function getTrends(bucket: Bucket): Promise<Trends> {
  const hasDb = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  return hasDb ? fromDatabase(bucket) : fromFiles(bucket);
}

export const parseBucket = (v: unknown): Bucket => (v === "month" ? "month" : "week");
