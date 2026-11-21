import "server-only";
import type { CardKind } from "./schemas";
import { createAdminClient } from "./supabase/admin";

// Bez embeddingów: cały AI idzie przez Groq, a Groq nie ma modeli embeddingów (0002_search.sql).
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

/** Podobne inicjatywy w regionie (także nieopublikowane): tylko id, gmina i podobieństwo — bez treści. */
export type SimilarHit = { initiative_id: string; teryt: string | null; municipality: string | null; similarity: number };

export async function similarInitiatives(keywords: string[], minSimilarity: number): Promise<SimilarHit[]> {
  if (keywords.length === 0) return [];
  const { data, error } = await createAdminClient().rpc("similar_initiatives_kw", {
    p_keywords: keywords,
    p_min_similarity: minSimilarity,
  });
  if (error) throw error;
  return (data ?? []) as SimilarHit[];
}

export type IndexEntry = {
  kind: CardKind;
  refId: string;
  title: string;
  body: string; // musi być zanonimizowany
  lemmas: string[];
  domains?: string[];
  tags?: string[]; // etap, tematy przekrojowe
  institutionType?: string | null;
  teryt?: string | null;
  active?: boolean;
};

/** Dodaje albo aktualizuje kartę we wspólnym indeksie (unikalność po kind + ref_id). */
export async function upsertIndex(e: IndexEntry): Promise<void> {
  const { error } = await createAdminClient().from("search_index").upsert(
    {
      kind: e.kind,
      ref_id: e.refId,
      title: e.title,
      body: e.body,
      lemmas: [...new Set(e.lemmas.map((l) => l.trim().toLowerCase()).filter(Boolean))].join(" "),
      domains: e.domains ?? [],
      tags: e.tags ?? [],
      institution_type: e.institutionType ?? null,
      teryt: e.teryt ?? null,
      active: e.active ?? true,
    },
    { onConflict: "kind,ref_id" },
  );
  if (error) throw error;
}
