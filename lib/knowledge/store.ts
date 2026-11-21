import "server-only";
import type { Domain, DomainKey, Fact, Material, MaterialFilter, Pattern, PatternFilter, ReadOptions } from "./types";

export type EntityKind = "rozwiazanie" | "fakt" | "material" | "dziedzina";
export type Entity = { rozwiazanie: Pattern; fakt: Fact; material: Material; dziedzina: Domain };

/**
 * Źródło danych bazy wiedzy. Dwie implementacje: pliki JSON (bez kluczy) i Supabase.
 * Zwraca wszystkie rekordy — o widoczności (opublikowane / panel) decydują `queries`.
 */
export interface KnowledgeStore {
  readonly mode: "pliki" | "baza";
  domains(): Promise<Domain[]>;
  facts(): Promise<Fact[]>;
  materials(): Promise<Material[]>;
  patterns(): Promise<Pattern[]>;
  save<K extends EntityKind>(kind: K, entity: Entity[K]): Promise<void>;
  remove(kind: EntityKind, id: string): Promise<void>;
  /** null, jeśli zapis jest możliwy; inaczej wyjaśnienie dla admina. */
  writeBlocker(): Promise<string | null>;
}

export class StoreError extends Error {}

const visible = <T extends { published: boolean }>(rows: T[], o?: ReadOptions) => (o?.all ? rows : rows.filter((r) => r.published));

export function filterPatterns(rows: Pattern[], f: PatternFilter = {}): Pattern[] {
  return rows.filter((p) =>
    (!f.domain || p.domains.includes(f.domain)) &&
    (!f.types?.length || (p.innovationType != null && f.types.includes(p.innovationType))) &&
    (!f.hasVideo || p.video != null));
}

export function filterMaterials(rows: Material[], f: MaterialFilter = {}): Material[] {
  return rows.filter((m) => (!f.kind || m.kind === f.kind) && (!f.domain || m.domains.includes(f.domain)));
}

/** Wspólne zapytania na dowolnym źródle. Moduły UI importują `knowledge`, nie konkretny store. */
export function queries(store: KnowledgeStore) {
  return {
    store,
    async domains(o?: ReadOptions) {
      return visible(await store.domains(), o).sort((a, b) => a.sort - b.sort);
    },
    async domain(slugOrKey: string, o?: ReadOptions) {
      return visible(await store.domains(), o).find((d) => d.slug === slugOrKey || d.key === slugOrKey) ?? null;
    },
    async facts(domain?: DomainKey, o?: ReadOptions) {
      return visible(await store.facts(), o).filter((f) => !domain || f.domain === domain).sort((a, b) => a.sort - b.sort);
    },
    async materials(f?: MaterialFilter, o?: ReadOptions) {
      return filterMaterials(visible(await store.materials(), o), f).sort((a, b) => a.sort - b.sort);
    },
    async patterns(f?: PatternFilter, o?: ReadOptions) {
      // Najpierw wybrane do upowszechniania (najlepiej opisane) i najczęściej przenoszone; dalej alfabetycznie.
      return filterPatterns(visible(await store.patterns(), o), f).sort((a, b) =>
        Number(b.dissemination) - Number(a.dissemination) ||
        b.adoptionsCount - a.adoptionsCount ||
        a.title.localeCompare(b.title, "pl"));
    },
    async pattern(slugOrId: string, o?: ReadOptions) {
      return visible(await store.patterns(), o).find((p) => p.slug === slugOrId || p.id === slugOrId) ?? null;
    },
  };
}

export type Knowledge = ReturnType<typeof queries>;
export { visible };
