import "server-only";
import gminyJson from "@/data/out/gminy.json";
import { gminaLabel } from "@/lib/gminy";
import { DOMAIN_KEYS, type DomainKey } from "@/lib/taxonomy";
import { demoData, hasDatabase } from "./demo-data";

/**
 * „Popyt bez podaży”: wyzwanie z „Szukam rozwiązania”, dla którego nic w bazie nie pasowało (challenges.is_gap,
 * najlepsze dopasowanie poniżej progu). Pokazuje, czego instytucje szukają, a czego jeszcze nikt nie zgłosił.
 */
export type GapChallenge = {
  id: string;
  teryt: string | null;
  createdAt: string;
  bestFit: number | null;
  summary: string;
  domains: DomainKey[];
};

/** Kierunek programu: dziedzina, w której wyzwania najczęściej nie mają rozwiązania. */
export type GapDirection = {
  domain: DomainKey;
  challenges: number;
  gminy: number;
  withoutGmina: number;          // wliczone w challenges, ale bez gminy, więc nie ma ich na mapie
  /** Średnie najlepsze dopasowanie (0–100) albo null. Im niżej, tym bardziej brakuje nowej inicjatywy. */
  avgFit: number | null;
  keywords: string[];            // najczęstsze słowa z kart wyzwań, do 5
};

export type Gaps = {
  challenges: GapChallenge[];    // od najnowszych
  byGmina: Record<string, number>;
  directions: GapDirection[];    // od największej liczby wyzwań
  synthetic: boolean;
  source: "baza" | "pliki";
};

type Card = { summary?: string; domains?: string[]; keywords?: string[] };
type Row = { id: string; teryt: string | null; created_at: string; best_fit: number | null; card: Card; synthetic?: boolean };

const isDomain = (d: string): d is DomainKey => (DOMAIN_KEYS as readonly string[]).includes(d);

function top<T extends string>(counts: Map<T, number>, n: number): T[] {
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl")).slice(0, n).map(([k]) => k);
}
const bump = <T,>(m: Map<T, number>, k: T) => m.set(k, (m.get(k) ?? 0) + 1);

function aggregate(rows: Row[], source: Gaps["source"]): Gaps {
  const byGmina: Record<string, number> = {};
  type Stats = { challenges: number; gminy: Set<string>; withoutGmina: number; fits: number[]; keywords: Map<string, number> };
  const perDomain = new Map<DomainKey, Stats>();

  for (const r of rows) {
    if (r.teryt) byGmina[r.teryt] = (byGmina[r.teryt] ?? 0) + 1;
    for (const d of (r.card.domains ?? []).filter(isDomain)) {
      const s: Stats = perDomain.get(d) ?? { challenges: 0, gminy: new Set(), withoutGmina: 0, fits: [], keywords: new Map() };
      s.challenges += 1;
      if (r.teryt) s.gminy.add(r.teryt);
      else s.withoutGmina += 1;
      if (r.best_fit != null) s.fits.push(r.best_fit);
      for (const k of r.card.keywords ?? []) bump(s.keywords, k.toLowerCase());
      perDomain.set(d, s);
    }
  }

  return {
    challenges: rows
      .map((r) => ({
        id: r.id,
        teryt: r.teryt,
        createdAt: r.created_at,
        bestFit: r.best_fit,
        summary: r.card.summary ?? "",
        domains: (r.card.domains ?? []).filter(isDomain),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    byGmina,
    directions: [...perDomain]
      .map(([domain, s]) => ({
        domain,
        challenges: s.challenges,
        gminy: s.gminy.size,
        withoutGmina: s.withoutGmina,
        avgFit: s.fits.length ? Math.round(s.fits.reduce((a, b) => a + b, 0) / s.fits.length) : null,
        keywords: top(s.keywords, 5),
      }))
      .sort((a, b) => b.challenges - a.challenges || b.gminy - a.gminy),
    synthetic: rows.some((r) => r.synthetic),
    source,
  };
}

async function fromFiles(): Promise<Gaps> {
  const { challenges } = await demoData();
  return aggregate(challenges.filter((c) => c.is_gap).map((c) => ({ ...c, synthetic: true })), "pliki");
}

async function fromDatabase(): Promise<Gaps> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await createAdminClient()
    .from("challenges")
    .select("id, teryt, created_at, best_fit, card, synthetic")
    .eq("is_gap", true)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return aggregate((data ?? []) as Row[], "baza");
}

/** Mapa luk — tylko dla admina (sprawdza wywołujący: requireAdmin / isAdmin). */
export async function getGaps(): Promise<Gaps> {
  return hasDatabase() ? fromDatabase() : fromFiles();
}

const GMINY = new Map(gminyJson.map((g) => [g.teryt, g]));

/** „Krosno (miasto na prawach powiatu)”; dla nieznanego TERYT sam kod. */
export function gapGminaLabel(teryt: string): string {
  const g = GMINY.get(teryt);
  return g ? gminaLabel(g) : `TERYT ${teryt}`;
}

/** Klasa mapy 0–4: 0 = brak luk, potem 1, 2, 3–4, 5 i więcej wyzwań. */
export function gapClass(n: number): number {
  return n <= 0 ? 0 : n <= 2 ? n : n <= 4 ? 3 : 4;
}

export const GAP_LEGEND = [
  { c: 0, text: "brak luk" },
  { c: 1, text: "1 wyzwanie" },
  { c: 2, text: "2 wyzwania" },
  { c: 3, text: "3–4 wyzwania" },
  { c: 4, text: "5 i więcej" },
];
