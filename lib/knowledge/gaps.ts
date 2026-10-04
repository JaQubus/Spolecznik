import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import gminyJson from "@/data/out/gminy.json";
import { gminaLabel } from "@/lib/gminy";
import { GROUPS, MWS_AREAS } from "@/lib/schemas";
import type { AreaKey } from "./types";

type GroupKey = (typeof GROUPS)[number];

/** Zgłoszenie ze statusem „luka”: najlepsze dopasowanie poniżej progu, czyli brak gotowego rozwiązania (README 5.1). */
export type GapNeed = {
  id: string | null;             // null w trybie plików — wtedy bez linku do karty zgłoszenia
  statusCode: string;
  teryt: string | null;
  createdAt: string;
  bestFit: number | null;
  summary: string;
  areas: AreaKey[];
};

/** Kierunek naboru: obszar, w którym zgłoszenia najczęściej nie mają rozwiązania. */
export type GapDirection = {
  area: AreaKey;
  needs: number;
  gminy: number;
  withoutGmina: number;          // wliczone w needs, ale bez gminy, więc nie ma ich na mapie
  /**
   * Średnie najlepsze dopasowanie (0–100) albo null. Próg luki to 50: im bliżej, tym bardziej coś podobnego
   * już jest w Bibliotece; im niżej, tym bardziej brakuje nowego rozwiązania.
   */
  avgFit: number | null;
  groups: GroupKey[];            // najczęstsze grupy docelowe, do 3
  keywords: string[];            // najczęstsze słowa z kart potrzeb, do 5
};

export type Gaps = {
  needs: GapNeed[];              // od najnowszych
  byGmina: Record<string, number>;
  directions: GapDirection[];    // od największej liczby zgłoszeń
  synthetic: boolean;
  source: "baza" | "pliki";
};

type Card = { summary?: string; areas?: string[]; groups?: string[]; keywords?: string[] };
type Row = { id?: string; status_code: string; teryt: string | null; created_at: string; best_fit: number | null; card: Card; synthetic?: boolean };

const isArea = (a: string): a is AreaKey => (MWS_AREAS as readonly string[]).includes(a);
const isGroup = (g: string): g is GroupKey => (GROUPS as readonly string[]).includes(g);

function top<T extends string>(counts: Map<T, number>, n: number): T[] {
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl")).slice(0, n).map(([k]) => k);
}
const bump = <T,>(m: Map<T, number>, k: T) => m.set(k, (m.get(k) ?? 0) + 1);

function aggregate(rows: Row[], source: Gaps["source"]): Gaps {
  const byGmina: Record<string, number> = {};
  type AreaStats = { needs: number; gminy: Set<string>; withoutGmina: number; fits: number[]; groups: Map<GroupKey, number>; keywords: Map<string, number> };
  const perArea = new Map<AreaKey, AreaStats>();

  for (const r of rows) {
    if (r.teryt) byGmina[r.teryt] = (byGmina[r.teryt] ?? 0) + 1;
    for (const a of (r.card.areas ?? []).filter(isArea)) {
      const s: AreaStats = perArea.get(a) ?? { needs: 0, gminy: new Set(), withoutGmina: 0, fits: [], groups: new Map(), keywords: new Map() };
      s.needs += 1;
      if (r.teryt) s.gminy.add(r.teryt);
      else s.withoutGmina += 1;
      if (r.best_fit != null) s.fits.push(r.best_fit);
      for (const g of (r.card.groups ?? []).filter(isGroup)) bump(s.groups, g);
      for (const k of r.card.keywords ?? []) bump(s.keywords, k.toLowerCase());
      perArea.set(a, s);
    }
  }

  return {
    needs: rows
      .map((r) => ({
        id: r.id ?? null,
        statusCode: r.status_code,
        teryt: r.teryt,
        createdAt: r.created_at,
        bestFit: r.best_fit,
        summary: r.card.summary ?? "",
        areas: (r.card.areas ?? []).filter(isArea),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    byGmina,
    directions: [...perArea]
      .map(([area, s]) => ({
        area,
        needs: s.needs,
        gminy: s.gminy.size,
        withoutGmina: s.withoutGmina,
        avgFit: s.fits.length ? Math.round(s.fits.reduce((a, b) => a + b, 0) / s.fits.length) : null,
        groups: top(s.groups, 3),
        keywords: top(s.keywords, 5),
      }))
      .sort((a, b) => b.needs - a.needs || b.gminy - a.gminy),
    synthetic: rows.some((r) => r.synthetic),
    source,
  };
}

async function fromFiles(): Promise<Gaps> {
  // Bez bazy: syntetyczne potrzeby z pipeline'u (data/seed_synthetic.py), jak w trendach.
  const file = path.join(process.cwd(), "data", "out", "synthetic.json");
  const synthetic = await readFile(file, "utf8").then(JSON.parse).catch(() => ({ needs: [] }));
  return aggregate(((synthetic.needs ?? []) as (Row & { status: string })[]).filter((n) => n.status === "luka"), "pliki");
}

async function fromDatabase(): Promise<Gaps> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await createAdminClient()
    .from("needs")
    .select("id, status_code, teryt, created_at, best_fit, card, synthetic")
    .eq("status", "luka")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return aggregate((data ?? []) as Row[], "baza");
}

/** Mapa luk — tylko dla admina (sprawdza wywołujący: requireAdmin / isAdmin). */
export async function getGaps(): Promise<Gaps> {
  const hasDb = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  return hasDb ? fromDatabase() : fromFiles();
}

const GMINY = new Map(gminyJson.map((g) => [g.teryt, g]));

/** „Olkusz (gmina miejsko-wiejska, powiat olkuski)”; dla nieznanego TERYT sam kod. */
export function gapGminaLabel(teryt: string): string {
  const g = GMINY.get(teryt);
  return g ? gminaLabel(g) : `TERYT ${teryt}`;
}

/** Klasa mapy 0–4: 0 = brak luk, potem 1, 2, 3–4, 5 i więcej zgłoszeń. */
export function gapClass(n: number): number {
  return n <= 0 ? 0 : n <= 2 ? n : n <= 4 ? 3 : 4;
}

export const GAP_LEGEND = [
  { c: 0, text: "brak luk" },
  { c: 1, text: "1 zgłoszenie" },
  { c: 2, text: "2 zgłoszenia" },
  { c: 3, text: "3–4 zgłoszenia" },
  { c: 4, text: "5 i więcej" },
];
