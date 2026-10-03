import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  areaFromRow, areaToRow, factFromRow, factToRow, innovationFromRow, innovationToRow,
  materialFromRow, materialToRow,
} from "./rows";
import { fileStore } from "./file-store";
import { StoreError, type Entity, type EntityKind, type KnowledgeStore } from "./store";

const TABLES = { obszar: "areas", fakt: "facts", material: "materials", innowacja: "innovations" } as const;

async function select<T>(table: string, map: (r: Record<string, unknown>) => T, filter?: [string, string]): Promise<T[]> {
  let q = createAdminClient().from(table).select("*");
  if (filter) q = q.eq(filter[0], filter[1]);
  const { data, error } = await q;
  if (error) throw new StoreError(`Nie udało się odczytać danych (${table}): ${error.message}`);
  return (data ?? []).map(map);
}

/**
 * Tryb z bazą: klient service_role po stronie serwera (jak reszta aplikacji). Publiczne strony
 * dostają tylko opublikowane rekordy — filtruje `queries`, a RLS pilnuje odczytu z przeglądarki.
 * Innowacje Zasobnika to corpus = 'biblioteka' (korpus pipeline'u matchmakingu działa obok).
 */
export const supabaseStore: KnowledgeStore = {
  mode: "baza",
  areas: () => select("areas", areaFromRow),
  facts: () => select("facts", factFromRow),
  materials: () => select("materials", materialFromRow),
  innovations: () => select("innovations", innovationFromRow, ["corpus", "biblioteka"]),
  // Persony z Mapy Wyzwań to treść statyczna — zawsze z plików.
  personas: () => fileStore.personas(),

  async save(kind, entity) {
    const supabase = createAdminClient();
    const row =
      kind === "obszar" ? areaToRow(entity as Entity["obszar"])
      : kind === "fakt" ? factToRow(entity as Entity["fakt"], "area_key")
      : kind === "material" ? materialToRow(entity as Entity["material"])
      : { ...innovationToRow(entity as Entity["innowacja"], "target_groups"), corpus: "biblioteka" };
    delete row.persona_keys; // tylko w plikach
    const { error } = await supabase.from(TABLES[kind]).upsert(
      { ...row, updated_at: new Date().toISOString() },
      { onConflict: kind === "obszar" ? "key" : "id" },
    );
    if (error) throw new StoreError(`Nie udało się zapisać: ${error.message}`);
  },

  async remove(kind: EntityKind, id: string) {
    const { error } = await createAdminClient().from(TABLES[kind]).delete().eq(kind === "obszar" ? "key" : "id", id);
    if (error) throw new StoreError(`Nie udało się usunąć: ${error.message}`);
  },

  writeBlocker: async () => null,
};
