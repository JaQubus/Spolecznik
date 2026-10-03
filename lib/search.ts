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

export type SearchHit = { ref_id: string; title: string; score: number };

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
