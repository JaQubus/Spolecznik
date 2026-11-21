import "server-only";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { labelClusters } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { DOMAIN_KEYS, type DomainKey } from "@/lib/taxonomy";
import { clusterCards, keywordOverlap, type KeywordCluster } from "./cluster-cards";
import { demoData, hasDatabase } from "./demo-data";

/** Grupa podobnych inicjatyw z etykietą z LLM (albo bez, jeśli jeszcze jej nie policzono). */
export type InitiativeCluster = KeywordCluster & {
  /** Krótki klucz do linku /panel?grupa=… */
  key: string;
  label: string | null;
  description: string | null;
  domains: DomainKey[];          // najczęstsze dziedziny, do 2
};

export type Clusters = {
  clusters: InitiativeCluster[]; // od największej
  unlabeled: number;
  source: "baza" | "pliki";
  synthetic: boolean;
  /** Ile inicjatyw przeszukano; `capped` — doszliśmy do LIMIT i starsze pominięto. */
  initiatives: number;
  capped: boolean;
};

type StoredLabel = { signature: string; keywords: string[]; label: string; description: string; size: number };
type Row = { id: string; teryt: string | null; summary: string; domains: DomainKey[]; keywords: string[]; synthetic: boolean };

/** Ponowne użycie etykiety, gdy grupa lekko się zmieniła: co najmniej tyle wspólnych słów (0–1). */
const LABEL_REUSE_OVERLAP = 0.6;
/** Grup w jednym wywołaniu Groq: ok. 4 tys. tokenów, poniżej limitu 8 tys. na minutę. */
const LABEL_BATCH = 15;
const SUMMARIES_PER_CLUSTER = 4;
/** Najnowsze inicjatywy brane do grup. */
export const INITIATIVES_LIMIT = 2000;

const LABELS_FILE = path.join(process.cwd(), "data", "out", "cluster_labels.json");
const isDomain = (d: string): d is DomainKey => (DOMAIN_KEYS as readonly string[]).includes(d);
export const clusterKey = (signature: string) => createHash("sha1").update(signature).digest("hex").slice(0, 10);

type Source = { id: string; teryt: string | null; summary: string; domains: string[]; card: { keywords?: string[] }; synthetic?: boolean };
const toRow = (r: Source): Row => ({
  id: r.id,
  teryt: r.teryt,
  summary: r.summary ?? "",
  domains: (r.domains ?? []).filter(isDomain),
  keywords: r.card?.keywords ?? [],
  synthetic: !!r.synthetic,
});

async function loadInitiatives(): Promise<Row[]> {
  if (!hasDatabase()) return (await demoData()).initiatives.map((i) => toRow({ ...i, synthetic: true }));
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await createAdminClient()
    .from("initiatives")
    .select("id, teryt, summary, domains, card, synthetic")
    .is("duplicate_of", null)
    .order("created_at", { ascending: false })
    .limit(INITIATIVES_LIMIT);
  if (error) throw error;
  return ((data ?? []) as Source[]).map(toRow);
}

async function loadLabels(): Promise<StoredLabel[]> {
  if (!hasDatabase()) return readFile(LABELS_FILE, "utf8").then((s) => JSON.parse(s).labels ?? []).catch(() => []);
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await createAdminClient().from("cluster_labels").select("signature, keywords, label, description, size");
  if (error) {
    console.error("[trendy] etykiety grup:", error); // bez tabeli grupy działają, tylko bez nazw
    return [];
  }
  return (data ?? []) as StoredLabel[];
}

async function saveLabels(fresh: StoredLabel[]): Promise<void> {
  if (!hasDatabase()) {
    const current = await loadLabels();
    const bySignature = new Map([...current, ...fresh].map((l) => [l.signature, l]));
    await writeFile(LABELS_FILE, `${JSON.stringify({ labels: [...bySignature.values()] }, null, 2)}\n`);
    return;
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { error } = await createAdminClient().from("cluster_labels").upsert(fresh, { onConflict: "signature" });
  if (error) throw error;
}

/** Etykieta po dokładnym podpisie, a jeśli go nie ma — najbliższa po słowach, której nie wzięła inna grupa. */
function attachLabels(groups: KeywordCluster[], labels: StoredLabel[]): Map<string, StoredLabel> {
  const out = new Map<string, StoredLabel>();
  const used = new Set<string>();
  const bySignature = new Map(labels.map((l) => [l.signature, l]));
  const take = (g: KeywordCluster, l: StoredLabel) => {
    out.set(g.signature, l);
    used.add(l.signature);
  };
  for (const g of groups) {
    const exact = bySignature.get(g.signature);
    if (exact) take(g, exact);
  }
  for (const g of groups) {
    if (out.has(g.signature)) continue;
    const words = g.signature.split("|");
    const best = labels
      .filter((l) => !used.has(l.signature))
      .map((l) => ({ l, overlap: keywordOverlap(words, l.keywords) }))
      .filter((c) => c.overlap >= LABEL_REUSE_OVERLAP)
      .sort((a, b) => b.overlap - a.overlap)[0];
    if (best) take(g, best.l);
  }
  return out;
}

async function compute(): Promise<{ result: Clusters; rows: Map<string, Row> }> {
  const [initiatives, labels] = await Promise.all([loadInitiatives(), loadLabels()]);
  const rows = new Map(initiatives.map((n) => [n.id, n]));
  const groups = clusterCards(initiatives);
  const labelOf = attachLabels(groups, labels);
  const clusters = groups.map((g): InitiativeCluster => {
    const domains = new Map<DomainKey, number>();
    for (const id of g.ids) for (const d of rows.get(id)!.domains) domains.set(d, (domains.get(d) ?? 0) + 1);
    const l = labelOf.get(g.signature);
    return {
      ...g,
      key: clusterKey(g.signature),
      label: l?.label ?? null,
      description: l?.description ?? null,
      domains: [...domains].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => d),
    };
  });
  return {
    rows,
    result: {
      clusters,
      unlabeled: clusters.filter((c) => !c.label).length,
      source: hasDatabase() ? "baza" : "pliki",
      synthetic: initiatives.some((n) => n.synthetic),
      initiatives: initiatives.length,
      capped: initiatives.length >= INITIATIVES_LIMIT,
    },
  };
}

/** Grupy podobnych inicjatyw — tylko dla admina (sprawdza wywołujący: requireAdmin / isAdmin). Bez wywołań LLM. */
export async function getClusters(): Promise<Clusters> {
  return (await compute()).result;
}

/**
 * Etykiety z LLM dla grup, które ich jeszcze nie mają — jedno wywołanie Groq na najwyżej LABEL_BATCH grup,
 * od największych. Wynik zostaje w bazie (cluster_labels) albo w data/out/cluster_labels.json.
 * Zwraca, ile grup nazwano i ile jeszcze czeka.
 */
export async function labelNewClusters(): Promise<{ labeled: number; remaining: number }> {
  const { result, rows } = await compute();
  const todo = result.clusters.filter((c) => !c.label).slice(0, LABEL_BATCH);
  if (todo.length === 0) return { labeled: 0, remaining: 0 };
  const labels = await labelClusters(todo.map((c) => ({
    keywords: c.keywords,
    // Streszczenia kart są już bez danych osobowych, ale maskujemy jeszcze raz przed wysłaniem do modelu.
    summaries: c.ids.slice(0, SUMMARIES_PER_CLUSTER).map((id) => anonymize(rows.get(id)!.summary).text).filter(Boolean),
  })));
  const fresh = labels.map((l): StoredLabel => {
    const c = todo[l.n];
    return { signature: c.signature, keywords: c.signature.split("|"), label: l.label.trim(), description: l.description.trim(), size: c.ids.length };
  });
  const unique = [...new Map(fresh.map((l) => [l.signature, l])).values()];
  await saveLabels(unique);
  return { labeled: unique.length, remaining: result.unlabeled - unique.length };
}
