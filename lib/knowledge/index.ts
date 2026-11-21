import "server-only";
import { fileStore } from "./file-store";
import { queries, type Entity, type EntityKind, type KnowledgeStore } from "./store";
import { supabaseStore } from "./supabase-store";

export const isSupabaseConfigured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase, gdy baza ma schemat Radaru (tabela `domains`); bez kluczy albo bez schematu — pliki content/library
// (+ zmiany w .data/). Wybór bazy zapamiętujemy, plików sprawdzamy ponownie co minutę.
let chosen: { store: KnowledgeStore; at: number } | null = null;

async function pick(): Promise<KnowledgeStore> {
  if (!isSupabaseConfigured()) return fileStore;
  if (chosen && (chosen.store === supabaseStore || Date.now() - chosen.at < 60_000)) return chosen.store;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { error } = await createAdminClient().from("domains").select("key").limit(1);
  if (error) console.warn("[knowledge] baza bez schematu Radaru (tabela domains) — czytam pliki content/library");
  chosen = { store: error ? fileStore : supabaseStore, at: Date.now() };
  return chosen.store;
}

const store: KnowledgeStore = {
  get mode() {
    return chosen?.store.mode ?? fileStore.mode;
  },
  domains: async () => (await pick()).domains(),
  facts: async () => (await pick()).facts(),
  materials: async () => (await pick()).materials(),
  patterns: async () => (await pick()).patterns(),
  async save<K extends EntityKind>(kind: K, entity: Entity[K]) {
    return (await pick()).save(kind, entity);
  },
  remove: async (kind, id) => (await pick()).remove(kind, id),
  writeBlocker: async () => (await pick()).writeBlocker(),
};

/** Baza wiedzy: Supabase ze schematem Radaru, inaczej pliki content/library. */
export const knowledge = queries(store);

export type { Knowledge } from "./store";
