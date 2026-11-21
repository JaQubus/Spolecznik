// Zakres widoczności w Panelu: administrator PCI widzi wszystko, opiekun instytucji tylko jej innowacje.
// Czysty moduł; ten sam podział egzekwuje w bazie RLS po institution_id (0010_public_panel.sql).

export type PanelScope = { kind: "all" } | { kind: "institution"; institutionId: string };

/** Zakres dla roli albo null, gdy rola nie ma wstępu do Panelu (opiekun bez przypisanej instytucji też nie ma). */
export function scopeFor(role: string, institutionId: string | null): PanelScope | null {
  if (role === "admin") return { kind: "all" };
  if (role === "institution" && institutionId) return { kind: "institution", institutionId };
  return null;
}

export const canSee = (scope: PanelScope, row: { institution_id: string | null }): boolean =>
  scope.kind === "all" || (row.institution_id != null && row.institution_id === scope.institutionId);

/** Sekcje Panelu dostępne dla zakresu. Opiekun instytucji: lista, lejek i eksport własnych innowacji. */
export const PANEL_SECTIONS = {
  all: ["/panel", "/panel/lejek", "/panel/wskazniki", "/panel/partnerzy", "/panel/instytucje", "/panel/zrodla", "/panel/programy"],
  institution: ["/panel", "/panel/lejek"],
} as const;
