// Sprawdzenie planu wdrożenia od modelu i jego wersja tekstowa („Kopiuj tekst”). Czyste funkcje bez importów
// serwerowych, żeby dało się je testować (tests/unit/implementation-plan.test.ts) i użyć w przeglądarce.
import {
  BUDGET_LABELS, BUDGET_MAX_PLN, GRANT, INSTITUTION_LABELS,
  type BudgetRange, type CheckedPlan, type GminaFact, type ImplementationPlan, type PlanDocument,
} from "./schemas.ts";

export type PartnerInfo = { id: string; name: string };

const clampMonth = (m: number) => Math.min(GRANT.maxMonths, Math.max(1, Math.round(m)));

/**
 * Plan od modelu → plan do pokazania. Liczby o gminie biorą się wyłącznie z `facts` (nieznane id odpadają),
 * partnerzy wyłącznie z `partners`. Limity naboru nie są poprawiane po cichu: przekroczenie trafia do `warnings`.
 */
export function checkPlan(
  raw: ImplementationPlan,
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
  if (preparationEnd > GRANT.maxPreparationMonths) {
    warnings.push(
      `Przygotowanie trwa ${preparationEnd} mies., a nabór dopuszcza najwyżej ${GRANT.maxPreparationMonths}. Skróć ten etap.`,
    );
  }
  if (totalPln > GRANT.maxPln) {
    warnings.push(`Suma kosztów działań (${zl(totalPln)}) przekracza maksymalny grant (${zl(GRANT.maxPln)}).`);
  } else if (totalPln > BUDGET_MAX_PLN[budget]) {
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
export const STAGE_LABELS = { przygotowanie: "Etap 1. Przygotowanie do wdrożenia", wdrozenie: "Etap 2. Wdrażanie usługi" } as const;

/** Plan jako zwykły tekst do schowka: te same sekcje i oznaczenia (SZACUNEK, źródła) co na ekranie. */
export function planToText(doc: PlanDocument): string {
  const p = doc.plan;
  const people = p.peopleSupported.women + p.peopleSupported.men;
  const lines: (string | false)[] = [
    `SZKIC PLANU WDROŻENIA: ${doc.innovation.title}`,
    `Gmina: ${doc.gmina.label}`,
    `Wnioskodawca: ${INSTITUTION_LABELS[doc.input.institutionType]}`,
    "Pod nabór „Usługa Wrażliwa” (ROPS w Krakowie). Szkic do sprawdzenia, nie gotowy wniosek.",
    "",
    "CEL USŁUGI", p.goal, "",
    "NA CZYM POLEGA USŁUGA", p.description, "",
    "FORMA USŁUGI", p.serviceForm, "",
    "ODBIORCY W GMINIE", p.audience.summary,
    ...p.audience.facts.map((f) => `- ${f.label}: ${formatFact(f)} (źródło: ${f.source}). ${f.why}`),
    "",
    `LICZBA OSÓB OBJĘTYCH WSPARCIEM (SZACUNEK): ${plNumber(people)} (kobiety ${plNumber(p.peopleSupported.women)}, mężczyźni ${plNumber(p.peopleSupported.men)}). ${p.peopleSupported.basis}`,
    "",
    "REKRUTACJA", p.recruitment, "",
    "HARMONOGRAM I KOSZTY DZIAŁAŃ (SZACUNEK)",
    ...p.steps.map((s) => `- [${STAGE_LABELS[s.stage]}, ${monthRange(s)}] ${s.title}: ${s.details} Koszt: ${zl(s.costPln)} (${s.costBasis})`),
    `Suma kosztów działań (SZACUNEK): ${zl(p.totalPln)}`,
    "",
    "KADRA I ZASOBY", p.staffAndResources, "",
    `WIDEŁKI KOSZTÓW (SZACUNEK): od ${zl(p.costEstimate.minPln)} do ${zl(p.costEstimate.maxPln)}. ${p.costEstimate.basis}`,
    "",
    p.partners.length > 0 && "PARTNERZY (z bazy ekspertów Społecznika)",
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
    "ZGODNOŚĆ Z ZASADAMI HORYZONTALNYMI", p.horizontalPrinciples, "",
    "UTRZYMANIE EFEKTÓW PO ZAKOŃCZENIU GRANTU", p.sustainability, "",
    "DEINSTYTUCJONALIZACJA", p.deinstitutionalization, "",
    p.warnings.length > 0 && "DO POPRAWY",
    ...p.warnings.map((w) => `- ${w}`),
    "ZAŁOŻENIA PRZYJĘTE PRZY TWORZENIU PLANU (do sprawdzenia)",
    ...p.assumptions.map((a) => `- ${a}`),
  ];
  return lines.filter((l) => l !== false).join("\n");
}
