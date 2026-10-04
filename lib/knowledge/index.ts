import "server-only";
import { fileStore } from "./file-store";
import { innovationFromRow } from "./rows";
import { queries, type Entity, type EntityKind, type KnowledgeStore } from "./store";
import type { Innovation } from "./types";
import { supabaseStore } from "./supabase-store";

export const isSupabaseConfigured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase dopiero, gdy jest migracja 0010_knowledge (tabela `areas`); do tego czasu — i bez kluczy —
// pliki content/knowledge (+ zmiany w .data/). Wybór bazy zapamiętujemy, plików sprawdzamy ponownie co minutę.
let chosen: { store: KnowledgeStore; at: number } | null = null;

async function pick(): Promise<KnowledgeStore> {
  if (!isSupabaseConfigured()) return fileStore;
  if (chosen && (chosen.store === supabaseStore || Date.now() - chosen.at < 60_000)) return chosen.store;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { error } = await createAdminClient().from("areas").select("key").limit(1);
  if (error) console.warn("[knowledge] brak migracji 0010_knowledge w bazie — czytam pliki content/knowledge");
  chosen = { store: error ? fileStore : supabaseStore, at: Date.now() };
  return chosen.store;
}

const store: KnowledgeStore = {
  get mode() {
    return chosen?.store.mode ?? fileStore.mode;
  },
  areas: async () => (await pick()).areas(),
  facts: async () => (await pick()).facts(),
  materials: async () => (await pick()).materials(),
  innovations: async () => (await pick()).innovations(),
  personas: async () => (await pick()).personas(),
  async save<K extends EntityKind>(kind: K, entity: Entity[K]) {
    return (await pick()).save(kind, entity);
  },
  remove: async (kind, id) => (await pick()).remove(kind, id),
  writeBlocker: async () => (await pick()).writeBlocker(),
};

/** Zasobnik wiedzy: Supabase z migracją 0010, inaczej pliki content/knowledge. */
export const knowledge = queries(store);

export type { Knowledge } from "./store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Jedna strona opisu dla każdej innowacji (/biblioteka/innowacja/[slug]): najpierw Zasobnik (corpus
 * „biblioteka”), a gdy jej tam nie ma — innowacja z pipeline'u dopasowań (corpus „pipeline”), do której
 * prowadzą wyniki „Opisz problem”, asystent Pracowni, Próba i Kondycja.
 */
export async function innovationPage(slugOrId: string): Promise<Innovation | null> {
  const found = await knowledge.innovation(slugOrId);
  if (found || !isSupabaseConfigured()) return found;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await createAdminClient()
    .from("innovations")
    .select("*")
    .eq(UUID.test(slugOrId) ? "id" : "slug", slugOrId)
    .eq("corpus", "pipeline")
    // Klient service_role omija RLS, więc warunek publikacji musi być tu jawnie — jak `visible()` w Zasobniku.
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data ? innovationFromRow(data) : null;
}
