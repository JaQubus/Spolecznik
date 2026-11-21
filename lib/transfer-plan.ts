// Sprawdzenie planu przeniesienia od modelu i jego wersja tekstowa („Kopiuj tekst”). Czyste funkcje bez importów
// serwerowych, żeby dało się je testować (tests/unit/transfer-plan.test.ts) i użyć w przeglądarce.
import {
  BUDGET_LABELS, BUDGET_MAX_PLN, TRANSFER,
  type BudgetRange, type CheckedPlan, type GminaFact, type PlanDocument, type TransferPlan,
} from "./schemas.ts";
import { institutionLabel } from "./taxonomy.ts";
import { brand } from "./brand.ts";

export type PartnerInfo = { id: string; name: string };

const clampMonth = (m: number) => Math.min(TRANSFER.maxMonths, Math.max(1, Math.round(m)));

/**
 * Plan od modelu → plan do pokazania. Liczby o gminie biorą się wyłącznie z `facts` (nieznane id odpadają),
 * partnerzy wyłącznie z `partners`. Ram planu nie poprawiamy po cichu: przekroczenie trafia do `warnings`.
 */
export function checkPlan(
  raw: TransferPlan,
  { facts, partners, budget }: { facts: GminaFact[]; partners: PartnerInfo[]; budget: BudgetRange },
): CheckedPlan {
  const factById = new Map(facts.map((f) => [f.id, f]));
  const seen = new Set<string>();
  const audienceFacts = raw.audience.facts.flatMap(({ factId, why }) => {
    const fact = factById.get(factId);
    if (!fact || seen.has(factId)) return [];
    seen.add(factId);
    return [{ ...fact, why }];
  });

  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const checkedPartners = raw.partners.flatMap((p) => {
    const known = partnerById.get(p.id);
    return known ? [{ id: p.id, name: known.name, role: p.role }] : [];
  });

  const steps = raw.steps
    .map((s) => {
      const monthFrom = clampMonth(s.monthFrom);
      return { ...s, monthFrom, monthTo: Math.max(monthFrom, clampMonth(s.monthTo)) };
    })
    .sort((a, b) => (a.stage === b.stage ? a.monthFrom - b.monthFrom : a.stage === "przygotowanie" ? -1 : 1));

  const totalPln = Math.round(steps.reduce((sum, s) => sum + s.costPln, 0));
  // Widełki mają obejmować sumę działań z tego samego planu; model czasem liczy je osobno i rozjeżdżają się.
  const [low, high] = [raw.costEstimate.minPln, raw.costEstimate.maxPln].sort((a, b) => a - b);
  const [minPln, maxPln] = [Math.min(low, totalPln), Math.max(high, totalPln)];

  const warnings: string[] = [];
  const preparationEnd = Math.max(0, ...steps.filter((s) => s.stage === "przygotowanie").map((s) => s.monthTo));
  if (preparationEnd > TRANSFER.maxPreparationMonths) {
    warnings.push(
      `Przygotowanie trwa ${preparationEnd} mies., a pilotaż zakłada najwyżej ${TRANSFER.maxPreparationMonths}. Skróć ten etap.`,
    );
  }
  if (!steps.some((s) => s.stage === "uruchomienie")) {
    warnings.push("Plan nie ma etapu uruchomienia. Dopisz, kiedy inicjatywa zacznie działać u Ciebie.");
  }
  const budgetMax = BUDGET_MAX_PLN[budget];
  if (budgetMax != null && totalPln > budgetMax) {
    warnings.push(`Suma kosztów działań (${zl(totalPln)}) przekracza wybrany budżet (${BUDGET_LABELS[budget]}).`);
  }

  return {
    ...raw,
    audience: { summary: raw.audience.summary, facts: audienceFacts },
    partners: checkedPartners,
    partnerTypes: checkedPartners.length > 0 ? [] : raw.partnerTypes,
    steps,
    costEstimate: { ...raw.costEstimate, minPln, maxPln },
    totalPln,
    warnings,
  };
}

const plNumber = (n: number, digits = 0) => n.toLocaleString("pl-PL", { maximumFractionDigits: digits });
export const zl = (n: number) => `${plNumber(Math.round(n))} zł`;
export const formatFact = (f: Pick<GminaFact, "value" | "unit">) =>
  f.unit === "%" ? `${plNumber(f.value, 1)}%` : `${plNumber(f.value, 2)} ${f.unit}`;
export const monthRange = (s: { monthFrom: number; monthTo: number }) =>
  s.monthFrom === s.monthTo ? `miesiąc ${s.monthFrom}` : `miesiące ${s.monthFrom}–${s.monthTo}`;
export const STAGE_LABELS = { przygotowanie: "Etap 1. Przygotowanie", uruchomienie: "Etap 2. Uruchomienie u nas" } as const;

/** Plan jako zwykły tekst do schowka: te same sekcje i oznaczenia (SZACUNEK, źródła) co na ekranie. */
export function planToText(doc: PlanDocument): string {
  const p = doc.plan;
  const lines: (string | false)[] = [
    `SZKIC PLANU PRZENIESIENIA: ${doc.source.title}`,
    `Gmina: ${doc.gmina.label}`,
    `Instytucja: ${institutionLabel(doc.input.institutionType)}`,
    `Przygotowane w serwisie ${brand.name}. Szkic do sprawdzenia, nie gotowy projekt.`,
    "",
    "CEL", p.goal, "",
    "JAK TO ZADZIAŁA U NAS", p.description, "",
    "CO ZMIENIAMY WZGLĘDEM ORYGINAŁU", p.adaptation, "",
    "ODBIORCY W GMINIE", p.audience.summary,
    ...p.audience.facts.map((f) => `- ${f.label}: ${formatFact(f)} (źródło: ${f.source}). ${f.why}`),
    "",
    `LICZBA ODBIORCÓW (SZACUNEK): ${plNumber(p.peopleReached.count)}. ${p.peopleReached.basis}`,
    "",
    "HARMONOGRAM I KOSZTY DZIAŁAŃ (SZACUNEK)",
    ...p.steps.map((s) => `- [${STAGE_LABELS[s.stage]}, ${monthRange(s)}] ${s.title}: ${s.details} Koszt: ${zl(s.costPln)} (${s.costBasis})`),
    `Suma kosztów działań (SZACUNEK): ${zl(p.totalPln)}`,
    "",
    "LUDZIE I ZASOBY", p.staffAndResources, "",
    `WIDEŁKI KOSZTÓW (SZACUNEK): od ${zl(p.costEstimate.minPln)} do ${zl(p.costEstimate.maxPln)}. ${p.costEstimate.basis}`,
    "",
    p.partners.length > 0 && "PARTNERZY (z bazy inicjatyw i mentorów)",
    ...p.partners.map((x) => `- ${x.name}: ${x.role}`),
    p.partnerTypes.length > 0 && "JAKICH PARTNERÓW SZUKAĆ",
    ...p.partnerTypes.map((t) => `- ${t}`),
    "",
    "RYZYKA I JAK JE OGRANICZYĆ",
    ...p.risks.map((r) => `- ${r.risk} → ${r.mitigation}`),
    "",
    "WSKAŹNIKI SUKCESU",
    ...p.successIndicators.map((i) => `- ${i}`),
    "",
    "CO ZOSTANIE PO PILOTAŻU", p.sustainability, "",
    p.warnings.length > 0 && "DO POPRAWY",
    ...p.warnings.map((w) => `- ${w}`),
    "ZAŁOŻENIA PRZYJĘTE PRZY TWORZENIU PLANU (do sprawdzenia)",
    ...p.assumptions.map((a) => `- ${a}`),
  ];
  return lines.filter((l) => l !== false).join("\n");
}
