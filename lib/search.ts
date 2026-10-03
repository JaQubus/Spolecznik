import "server-only";
import type { CardKind } from "./schemas";
import { createAdminClient } from "./supabase/admin";

// Bez embeddingów: cały AI idzie przez Groq, a Groq nie ma modeli embeddingów (migracja 0005).
// Wyszukujemy po słowach kluczowych w formie podstawowej z LLM, a znaczenie ocenia rerank.

/** similarity = jaka część słów kluczowych zapytania pasuje do karty (0–1). */
export type SearchHit = { ref_id: string; title: string; teryt: string | null; score: number; similarity: number };

export async function keywordSearch(kind: CardKind, keywords: string[], count = 15): Promise<SearchHit[]> {
  if (keywords.length === 0) return [];
  const { data, error } = await createAdminClient().rpc("keyword_search", {
    p_kind: kind,
    p_keywords: keywords,
    p_count: count,
  });
  if (error) throw error;
  return (data ?? []) as SearchHit[];
}

export type SimilarNeed = { need_id: string; teryt: string | null; gmina: string | null; similarity: number };

export async function similarNeeds(keywords: string[], minSimilarity: number): Promise<SimilarNeed[]> {
  if (keywords.length === 0) return [];
  const { data, error } = await createAdminClient().rpc("similar_needs_kw", {
    p_keywords: keywords,
    p_min_similarity: minSimilarity,
  });
  if (error) throw error;
  return (data ?? []) as SimilarNeed[];
}

/**
 * Zapytanie po prefiksach słów: 'samotno:* | senior:*'. Fragmenty raportów nie mają lematów,
 * a ucięcie końcówki łapie polskie odmiany („samotność” → „samotności”, „żłobek” → „żłobku”).
 */
export function prefixQuery(keywords: string[]): string {
  const words = keywords
    .flatMap((k) => k.toLowerCase().split(/\s+/))
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length >= 3)
    .map((w) => `${w.slice(0, Math.max(4, w.length - 2))}:*`);
  return [...new Set(words)].join(" | ");
}

export type DocChunkHit = {
  id: string;
  doc_title: string;
  year: number | null;
  url: string | null;
  page: number | null;
  text: string;
  score: number;
};

export async function searchDocChunks(keywords: string[], count = 6): Promise<DocChunkHit[]> {
  const query = prefixQuery(keywords);
  if (!query) return [];
  const { data, error } = await createAdminClient().rpc("search_doc_chunks", { p_query: query, p_count: count });
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
    },
    { onConflict: "kind,ref_id" },
  );
  if (error) throw error;
}
