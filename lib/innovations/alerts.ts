// Alerty dla partnerów: kiedy nowa innowacja pasuje do profilu. Czysty moduł (wysyłka: alerts-send.ts).

export type AlertProfile = { sectors: readonly string[]; kinds: readonly string[]; trlMin: number | null; trlMax: number | null };
export type AlertTarget = { sectors: readonly string[]; innovation_kind: string | null; trl: number | null };

/**
 * Pusty wybór sektorów albo typów = wszystkie. Zakres TRL sprawdzamy tylko tam, gdzie innowacja ma TRL —
 * innowacja organizacyjna czy edukacyjna go nie ma i nie odpada z powodu zakresu.
 */
export function alertMatches(a: AlertProfile, t: AlertTarget): boolean {
  if (a.sectors.length > 0 && !t.sectors.some((s) => a.sectors.includes(s))) return false;
  if (a.kinds.length > 0 && !(t.innovation_kind && a.kinds.includes(t.innovation_kind))) return false;
  if (t.trl != null) {
    if (a.trlMin != null && t.trl < a.trlMin) return false;
    if (a.trlMax != null && t.trl > a.trlMax) return false;
  }
  return true;
}
