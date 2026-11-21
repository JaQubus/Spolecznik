import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  domainFromRow, domainToRow, factFromRow, factToRow, materialFromRow, materialToRow, patternFromRow, patternToRow,
} from "./rows";
import { StoreError, type Entity, type EntityKind, type KnowledgeStore } from "./store";

const TABLES = { dziedzina: "domains", fakt: "facts", material: "materials", rozwiazanie: "patterns" } as const;

async function select<T>(table: string, map: (r: Record<string, unknown>) => T): Promise<T[]> {
  const { data, error } = await createAdminClient().from(table).select("*");
  if (error) throw new StoreError(`Nie udało się odczytać danych (${table}): ${error.message}`);
  return (data ?? []).map(map);
}

/**
 * Tryb z bazą: klient service_role po stronie serwera (jak reszta aplikacji). Publiczne strony
 * dostają tylko opublikowane rekordy — filtruje `queries`, a RLS pilnuje odczytu z przeglądarki.
 */
export const supabaseStore: KnowledgeStore = {
  mode: "baza",
  domains: () => select(TABLES.dziedzina, domainFromRow),
  facts: () => select(TABLES.fakt, factFromRow),
  materials: () => select(TABLES.material, materialFromRow),
  patterns: () => select(TABLES.rozwiazanie, patternFromRow),

  async save(kind, entity) {
    const row =
      kind === "dziedzina" ? domainToRow(entity as Entity["dziedzina"])
      : kind === "fakt" ? factToRow(entity as Entity["fakt"], "domain_key")
      : kind === "material" ? materialToRow(entity as Entity["material"])
      : patternToRow(entity as Entity["rozwiazanie"]);
    const { error } = await createAdminClient().from(TABLES[kind]).upsert(
      { ...row, updated_at: new Date().toISOString() },
      { onConflict: kind === "dziedzina" ? "key" : "id" },
    );
    if (error) throw new StoreError(`Nie udało się zapisać: ${error.message}`);
  },

  async remove(kind: EntityKind, id: string) {
    const { error } = await createAdminClient().from(TABLES[kind]).delete().eq(kind === "dziedzina" ? "key" : "id", id);
    if (error) throw new StoreError(`Nie udało się usunąć: ${error.message}`);
  },

  writeBlocker: async () => null,
};
