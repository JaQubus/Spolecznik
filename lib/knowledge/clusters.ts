import "server-only";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { labelClusters } from "@/lib/llm";
import { anonymize } from "@/lib/pii";
import { MWS_AREAS } from "@/lib/schemas";
import { clusterNeeds, keywordOverlap, type KeywordCluster } from "./cluster-needs";
import type { AreaKey } from "./types";

/** Grupa podobnych zgłoszeń z etykietą z LLM (albo bez, jeśli jeszcze jej nie policzono). */
export type NeedCluster = KeywordCluster & {
  /** Krótki klucz do linku /panel?grupa=… */
  key: string;
  label: string | null;
  description: string | null;
  areas: AreaKey[];              // najczęstsze obszary, do 2
};

export type Clusters = {
  clusters: NeedCluster[];       // od największej
  unlabeled: number;
  /** W trybie plików zgłoszenia nie mają id, więc grupa nie linkuje do skrzynki. */
  source: "baza" | "pliki";
  synthetic: boolean;
};

type StoredLabel = { signature: string; keywords: string[]; label: string; description: string; needs: number };
type Row = { id: string; teryt: string | null; summary: string; areas: AreaKey[]; keywords: string[]; synthetic: boolean };

/** Ponowne użycie etykiety, gdy grupa lekko się zmieniła: co najmniej tyle wspólnych słów (0–1). */
const LABEL_REUSE_OVERLAP = 0.6;
/** Grup w jednym wywołaniu Groq: ok. 4 tys. tokenów, poniżej limitu 8 tys. na minutę. */
const LABEL_BATCH = 15;
const SUMMARIES_PER_CLUSTER = 4;

const hasDb = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const LABELS_FILE = path.join(process.cwd(), "data", "out", "cluster_labels.json");
const isArea = (a: string): a is AreaKey => (MWS_AREAS as readonly string[]).includes(a);
export const clusterKey = (signature: string) => createHash("sha1").update(signature).digest("hex").slice(0, 10);

type Card = { summary?: string; areas?: string[]; keywords?: string[] };
const toRow = (id: string, r: { teryt: string | null; card: Card; synthetic?: boolean }): Row => ({
  id,
  teryt: r.teryt,
  summary: r.card.summary ?? "",
  areas: (r.card.areas ?? []).filter(isArea),
  keywords: r.card.keywords ?? [],
  synthetic: !!r.synthetic,
});

async function loadNeeds(): Promise<Row[]> {
  if (!hasDb()) {
    // Bez bazy: syntetyczne potrzeby z pipeline'u (data/seed_synthetic.py), jak w trendach. Bez id — kod statusu.
    const file = path.join(process.cwd(), "data", "out", "synthetic.json");
    const synthetic = await readFile(file, "utf8").then(JSON.parse).catch(() => ({ needs: [] }));
    return ((synthetic.needs ?? []) as { status_code: string; teryt: string | null; card: Card; synthetic?: boolean }[])
      .map((n) => toRow(n.status_code, n));
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await createAdminClient()
    .from("needs")
    .select("id, teryt, card, synthetic")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return ((data ?? []) as { id: string; teryt: string | null; card: Card; synthetic: boolean }[]).map((n) => toRow(n.id, n));
}

async function loadLabels(): Promise<StoredLabel[]> {
  if (!hasDb()) return readFile(LABELS_FILE, "utf8").then((s) => JSON.parse(s).labels ?? []).catch(() => []);
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await createAdminClient().from("need_cluster_labels").select("signature, keywords, label, description, needs");
  if (error) {
    console.error("[trendy] etykiety grup (migracja 0019?):", error); // bez tabeli grupy działają, tylko bez nazw
    return [];
  }
  return (data ?? []) as StoredLabel[];
}

async function saveLabels(fresh: StoredLabel[]): Promise<void> {
  if (!hasDb()) {
    const current = await loadLabels();
    const bySignature = new Map([...current, ...fresh].map((l) => [l.signature, l]));
    await writeFile(LABELS_FILE, `${JSON.stringify({ labels: [...bySignature.values()] }, null, 2)}\n`);
    return;
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { error } = await createAdminClient().from("need_cluster_labels").upsert(fresh, { onConflict: "signature" });
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
  const [needs, labels] = await Promise.all([loadNeeds(), loadLabels()]);
  const rows = new Map(needs.map((n) => [n.id, n]));
  const groups = clusterNeeds(needs);
  const labelOf = attachLabels(groups, labels);
  const clusters = groups.map((g): NeedCluster => {
    const areas = new Map<AreaKey, number>();
    for (const id of g.ids) for (const a of rows.get(id)!.areas) areas.set(a, (areas.get(a) ?? 0) + 1);
    const l = labelOf.get(g.signature);
    return {
      ...g,
      key: clusterKey(g.signature),
      label: l?.label ?? null,
      description: l?.description ?? null,
      areas: [...areas].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([a]) => a),
    };
  });
  return {
    rows,
    result: {
      clusters,
      unlabeled: clusters.filter((c) => !c.label).length,
      source: hasDb() ? "baza" : "pliki",
      synthetic: needs.some((n) => n.synthetic),
    },
  };
}

/** Grupy podobnych potrzeb — tylko dla admina (sprawdza wywołujący: requireAdmin / isAdmin). Bez wywołań LLM. */
export async function getClusters(): Promise<Clusters> {
  return (await compute()).result;
}

/**
 * Etykiety z LLM dla grup, które ich jeszcze nie mają — jedno wywołanie Groq na najwyżej LABEL_BATCH grup,
 * od największych. Wynik zostaje w bazie (need_cluster_labels) albo w data/out/cluster_labels.json.
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
    return { signature: c.signature, keywords: c.signature.split("|"), label: l.label.trim(), description: l.description.trim(), needs: c.ids.length };
  });
  const unique = [...new Map(fresh.map((l) => [l.signature, l])).values()];
  await saveLabels(unique);
  return { labeled: unique.length, remaining: result.unlabeled - unique.length };
}
