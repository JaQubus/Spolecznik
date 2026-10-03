import "server-only";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import type { CardKind } from "./schemas";
import { createAdminClient } from "./supabase/admin";

// Musi zgadzać się z wymiarem vector(...) w migracji.
const embeddingModel = openai.embeddingModel("text-embedding-3-small");

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel, value: text });
  return embedding;
}

/** Buduje zapytanie websearch: 'senior or samotność or "transport publiczny"'. */
export function keywordQuery(keywords: string[]): string {
  return keywords
    .map((k) => k.trim().toLowerCase().replace(/"/g, ""))
    .filter(Boolean)
    .map((k) => (k.includes(" ") ? `"${k}"` : k))
    .join(" or ");
}

export type SearchHit = { ref_id: string; title: string; score: number; similarity: number };

export async function hybridSearch(
  kind: CardKind,
  keywords: string[],
  embedding: number[],
  count = 15,
): Promise<SearchHit[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("hybrid_search", {
    p_kind: kind,
    p_keywords: keywordQuery(keywords),
    p_embedding: JSON.stringify(embedding),
    p_count: count,
  });
  if (error) throw error;
  return (data ?? []) as SearchHit[];
}

export type SimilarNeed = { need_id: string; teryt: string | null; gmina: string | null; similarity: number };

export async function similarNeeds(embedding: number[], minSimilarity: number): Promise<SimilarNeed[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("similar_needs", {
    p_embedding: JSON.stringify(embedding),
    p_min_similarity: minSimilarity,
  });
  if (error) throw error;
  return (data ?? []) as SimilarNeed[];
}

export type DocChunkHit = {
  id: string;
  doc_title: string;
  year: number | null;
  url: string | null;
  page: number | null;
  text: string;
  similarity: number;
};

export async function searchDocChunks(embedding: number[], count = 6): Promise<DocChunkHit[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_doc_chunks", {
    p_embedding: JSON.stringify(embedding),
    p_count: count,
  });
  if (error) throw error;
  return (data ?? []) as DocChunkHit[];
}

export type IndexEntry = {
  kind: CardKind;
  refId: string;
  title: string;
  body: string; // musi być zanonimizowany
  lemmas: string[];
  areas?: string[];
  targetGroups?: string[];
  teryt?: string | null;
  active?: boolean;
  embedding: number[];
};

/** Dodaje albo aktualizuje kartę we wspólnym indeksie (unikalność po kind + ref_id). */
export async function upsertIndex(e: IndexEntry): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("search_index").upsert(
    {
      kind: e.kind,
      ref_id: e.refId,
      title: e.title,
      body: e.body,
      lemmas: e.lemmas.map((l) => l.toLowerCase()).join(" "),
      areas: e.areas ?? [],
      target_groups: e.targetGroups ?? [],
      teryt: e.teryt ?? null,
      active: e.active ?? true,
      embedding: JSON.stringify(e.embedding),
    },
    { onConflict: "kind,ref_id" },
  );
  if (error) throw error;
}
