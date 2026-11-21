// Scalanie duplikatów (initiatives.duplicate_of): reguły bez bazy, żeby dało się je przetestować.

export type MergeProblem = "samo_w_siebie" | "brak_celu" | "cel_jest_duplikatem" | "juz_scalona" | "ma_scalone";

/**
 * Zgłoszenie `source` zostaje duplikatem `target`. Zabraniamy cykli i łańcuchów: cel nie może sam być
 * duplikatem, a zgłoszenie, do którego ktoś już został scalony, nie może zniknąć pod innym.
 */
export function mergeProblem(
  source: { id: string; duplicate_of: string | null; mergedCount: number },
  target: { id: string; duplicate_of: string | null } | null,
): MergeProblem | null {
  if (!target) return "brak_celu";
  if (target.id === source.id) return "samo_w_siebie";
  if (source.duplicate_of) return "juz_scalona";
  if (source.mergedCount > 0) return "ma_scalone";
  if (target.duplicate_of) return "cel_jest_duplikatem";
  return null;
}

export const MERGE_MESSAGES: Record<MergeProblem, string> = {
  samo_w_siebie: "Nie można scalić zgłoszenia z nim samym.",
  brak_celu: "Nie znaleziono inicjatywy o tym kodzie.",
  cel_jest_duplikatem: "Ta inicjatywa sama jest już duplikatem innej. Scal z tamtą.",
  juz_scalona: "To zgłoszenie jest już scalone. Najpierw cofnij scalenie.",
  ma_scalone: "Inne zgłoszenia są scalone z tym. Najpierw cofnij ich scalenie.",
};
