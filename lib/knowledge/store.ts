import "server-only";
import type {
  Area, AreaKey, Fact, Innovation, InnovationFilter, Material, MaterialFilter, Persona, ReadOptions,
} from "./types";

export type EntityKind = "innowacja" | "fakt" | "material" | "obszar";
export type Entity = { innowacja: Innovation; fakt: Fact; material: Material; obszar: Area };

/**
 * Źródło danych Zasobnika. Dwie implementacje: pliki JSON (bez kluczy) i Supabase.
 * Zwraca wszystkie rekordy — o widoczności (opublikowane / panel) decydują `queries`.
 */
export interface KnowledgeStore {
  readonly mode: "pliki" | "baza";
  areas(): Promise<Area[]>;
  facts(): Promise<Fact[]>;
  materials(): Promise<Material[]>;
  innovations(): Promise<Innovation[]>;
  personas(): Promise<Persona[]>;
  save<K extends EntityKind>(kind: K, entity: Entity[K]): Promise<void>;
  remove(kind: EntityKind, id: string): Promise<void>;
  /** null, jeśli zapis jest możliwy; inaczej wyjaśnienie dla admina. */
  writeBlocker(): Promise<string | null>;
}

export class StoreError extends Error {}

const visible = <T extends { published: boolean }>(rows: T[], o?: ReadOptions) => (o?.all ? rows : rows.filter((r) => r.published));

export function filterInnovations(rows: Innovation[], f: InnovationFilter = {}): Innovation[] {
  return rows.filter((i) =>
    (!f.area || i.areas.includes(f.area)) &&
    (!f.group || i.groups.includes(f.group)) &&
    (!f.types?.length || (i.innovationType != null && f.types.includes(i.innovationType))) &&
    (!f.hasVideo || i.video != null));
}

export function filterMaterials(rows: Material[], f: MaterialFilter = {}): Material[] {
  return rows.filter((m) => (!f.kind || m.kind === f.kind) && (!f.area || m.areas.includes(f.area)));
}

/** Wspólne zapytania na dowolnym źródle. Moduły UI importują `knowledge`, nie konkretny store. */
export function queries(store: KnowledgeStore) {
  return {
    store,
    async areas(o?: ReadOptions) {
      return visible(await store.areas(), o).sort((a, b) => a.sort - b.sort);
    },
    async area(slugOrKey: string, o?: ReadOptions) {
      return visible(await store.areas(), o).find((a) => a.slug === slugOrKey || a.key === slugOrKey) ?? null;
    },
    async facts(area?: AreaKey, o?: ReadOptions) {
      return visible(await store.facts(), o).filter((f) => !area || f.area === area).sort((a, b) => a.sort - b.sort);
    },
    async materials(f?: MaterialFilter, o?: ReadOptions) {
      return filterMaterials(visible(await store.materials(), o), f).sort((a, b) => a.sort - b.sort);
    },
    async innovations(f?: InnovationFilter, o?: ReadOptions) {
      // Najpierw wybrane do upowszechniania (najlepiej opisane); dalej alfabetycznie. Film nie wpływa na kolejność.
      return filterInnovations(visible(await store.innovations(), o), f).sort((a, b) =>
        Number(b.dissemination) - Number(a.dissemination) ||
        a.title.localeCompare(b.title, "pl"));
    },
    async innovation(slugOrId: string, o?: ReadOptions) {
      return visible(await store.innovations(), o).find((i) => i.slug === slugOrId || i.id === slugOrId) ?? null;
    },
    async personas() {
      return store.personas();
    },
  };
}

export type Knowledge = ReturnType<typeof queries>;
export { visible };
