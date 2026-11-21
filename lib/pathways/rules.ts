// Ścieżki rozwoju (6/10): reguły wstępne bez LLM. Czyste funkcje bez importów serwerowych i bez aliasu „@/”,
// żeby testy jednostkowe (node --test --experimental-strip-types) ładowały ten plik wprost.
// Reguły, mierniki i „kto pomaga” są w config/taxonomy.json (pathways, pathwayRules, pathwayFallback, easeOfAdoption).
import { maturityCap } from "../radar/score.ts";
import {
  EASE_OF_ADOPTION, INNOVATION_KIND_KEYS, PATHWAY_FALLBACK, PATHWAY_KEYS, PATHWAY_RULES, PATHWAYS, RADAR, RADAR_KEYS, TRL_MAX,
  innovationKindLabel, institutionLabel, ipStatusLabel, stageLabel,
  type InnovationKindKey, type PartnerKindKey, type PartnerSupportKey, type PathwayCondition, type PathwayKey, type RadarKey,
} from "../taxonomy.ts";

/** Co wiemy o innowacji: kolumny inicjatywy, role twórców i (jeśli już jest) ocena radaru. */
export type PathwayInput = {
  innovationKind: string | null;
  stage: string | null;
  trl: number | null;
  sectors: string[];
  ipStatus: string | null;
  institutionType: string | null;
  creatorRoles: string[];
  /** Oceny wymiarów radaru po regułach (lib/radar/score.ts); null, gdy oceny jeszcze nie ma. */
  radar: { dimensions: Record<RadarKey, { score: number }> } | null;
  adoptionsCount?: number;
};

/** Łatwość wdrożenia 0–5: dawny wymiar radaru, teraz element ścieżki „wdrożenie”. */
export type EaseOfAdoption = {
  score: number;
  label: string;
  /** Składniki wyniku jawnie, zdaniami do pokazania pod oceną. */
  factors: string[];
  /** true: bez oceny radaru, szacunek z typu i etapu. */
  estimated: boolean;
};

export type RecommendedPathway = {
  key: PathwayKey;
  label: string;
  description: string;
  variant: string;
  variantLabel: string;
  /** Inne warianty tej ścieżki, które też dostały punkty (np. „także: laboratoria PCI”). */
  alsoVariants: { key: string; label: string }[];
  points: number;
  /** Powody z reguł, które zadziałały — to samo widzi Panel i twórca. */
  reasons: string[];
  /** Oczekiwane mierniki skuteczności (z konfiguracji, szablony już wypełnione). */
  metrics: string[];
  /** Kto pomaga: PCI, CTT, mentor… */
  helpers: string[];
  partnerSupport: PartnerSupportKey[];
  partnerKinds: PartnerKindKey[];
  /** Tylko przy „wdrożeniu”. */
  ease: EaseOfAdoption | null;
  /** Żadna reguła nie dała dość punktów; to bezpieczny pierwszy krok z pathwayFallback. */
  fallback: boolean;
};

export type PathwayRecommendation = { pathways: RecommendedPathway[]; ease: EaseOfAdoption; withRadar: boolean };

const YOUTH_ROLES = new Set(["uczen", "student"]);
const clamp = (n: number) => Math.min(5, Math.max(0, Math.round(n)));
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function easeOfAdoption(input: PathwayInput): EaseOfAdoption {
  const w = EASE_OF_ADOPTION.weights;
  const kind = (INNOVATION_KIND_KEYS as readonly string[]).includes(input.innovationKind ?? "") ? (input.innovationKind as InnovationKindKey) : null;
  const kindBase = kind ? EASE_OF_ADOPTION.kindBase[kind] : 3;
  const estimated = !input.radar;
  const scalability = input.radar?.dimensions.skalowalnosc?.score ?? RADAR.noDataMax;
  const maturity = input.radar?.dimensions.dojrzalosc?.score ?? maturityCap({ stage: input.stage, innovationKind: input.innovationKind, trl: input.trl }).cap;
  const transferred = input.stage === "przeniesiona" || (input.adoptionsCount ?? 0) > 0;
  const score = clamp(w.skalowalnosc * scalability + w.dojrzalosc * maturity + w.kind * kindBase + (transferred ? EASE_OF_ADOPTION.transferredBonus : 0));
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const factors = [
    `Skalowalność ${scalability}/5${estimated ? " (bez oceny radaru)" : ""}, waga ${pct(w.skalowalnosc)}`,
    `Dojrzałość ${maturity}/5${estimated ? " (limit etapu)" : ""}, waga ${pct(w.dojrzalosc)}`,
    `Typ ${kind ? `„${innovationKindLabel(kind)}”` : "nieznany"}: ${kindBase}/5, waga ${pct(w.kind)}`,
    ...(transferred ? [`Działa już w innym miejscu: +${EASE_OF_ADOPTION.transferredBonus}`] : []),
  ];
  const label = EASE_OF_ADOPTION.levels.find((l) => score >= l.min)?.label ?? EASE_OF_ADOPTION.levels.at(-1)!.label;
  return { score, label, factors, estimated };
}

type RuleContext = PathwayInput & { ease: number; youth: boolean };

/** Warunek reguły: wszystkie podane pola muszą się zgadzać. Pola radaru bez oceny radaru nigdy nie są spełnione. */
export function conditionHolds(c: PathwayCondition, x: RuleContext): boolean {
  const kind = x.innovationKind ?? "";
  if (c.kinds && !(c.kinds as string[]).includes(kind)) return false;
  if (c.notKinds && (c.notKinds as string[]).includes(kind)) return false;
  if (c.trlMin != null && (x.trl == null || x.trl < c.trlMin)) return false;
  if (c.trlMax != null && (x.trl == null || x.trl > c.trlMax)) return false;
  if (c.stages && !(c.stages as string[]).includes(x.stage ?? "")) return false;
  if (c.sectorPci != null && x.sectors.some((s) => s !== "inne") !== c.sectorPci) return false;
  if (c.ip && !(c.ip as string[]).includes(x.ipStatus ?? "")) return false;
  if (c.ipMissing != null && (x.ipStatus == null || x.ipStatus === "brak") !== c.ipMissing) return false;
  if (c.institutionTypes && !(c.institutionTypes as string[]).includes(x.institutionType ?? "")) return false;
  if (c.youth != null && x.youth !== c.youth) return false;
  if (c.easeMin != null && x.ease < c.easeMin) return false;
  for (const [dim, min] of Object.entries(c.radarMin ?? {})) {
    const s = x.radar?.dimensions[dim as RadarKey]?.score;
    if (s == null || s < min) return false;
  }
  for (const [dim, max] of Object.entries(c.radarMax ?? {})) {
    const s = x.radar?.dimensions[dim as RadarKey]?.score;
    if (s == null || s > max) return false;
  }
  return true;
}

/** Zmienne szablonów powodów i mierników: {trl}, {trlTarget}, {ip}, {kind}, {stage}, {ease} i oceny wymiarów radaru. */
export function templateVars(x: PathwayInput, ease: number): Record<string, string> {
  const vars: Record<string, string> = { ease: String(ease) };
  if (x.trl != null) {
    vars.trl = String(x.trl);
    vars.trlTarget = String(Math.min(TRL_MAX, x.trl + 2));
  }
  if (x.ipStatus) vars.ip = lowerFirst(ipStatusLabel(x.ipStatus));
  if (x.innovationKind) vars.kind = lowerFirst(innovationKindLabel(x.innovationKind));
  if (x.stage) vars.stage = stageLabel(x.stage);
  for (const k of RADAR_KEYS) {
    const s = x.radar?.dimensions[k]?.score;
    if (s != null) vars[k] = String(s);
  }
  return vars;
}

/** Wypełnia {zmienne}; null, gdy którejś brakuje (np. {trl} przy innowacji nietechnologicznej) — taki tekst pomijamy. */
export function fillTemplate(text: string, vars: Record<string, string>): string | null {
  let missing = false;
  const out = text.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (vars[name] == null) missing = true;
    return vars[name] ?? "";
  });
  return missing ? null : out;
}

function buildPathway(
  key: PathwayKey, variantPoints: Map<string, number>, points: number, reasons: string[], x: PathwayInput,
  vars: Record<string, string>, ease: EaseOfAdoption, fallback: boolean, fallbackVariant?: string,
): RecommendedPathway {
  const kind = PATHWAYS.kinds[key];
  const order = Object.keys(kind.variants);
  // Wariant z największą liczbą punktów; przy remisie pierwszy w kolejności z konfiguracji.
  const ranked = order.filter((v) => (variantPoints.get(v) ?? 0) > 0).sort((a, b) => (variantPoints.get(b) ?? 0) - (variantPoints.get(a) ?? 0));
  const variant = fallbackVariant ?? ranked[0] ?? order[0];
  const v = kind.variants[variant];
  const templates = (x.innovationKind && v.metricsByKind?.[x.innovationKind as InnovationKindKey]) || v.metrics;
  return {
    key,
    label: kind.label,
    description: kind.description,
    variant,
    variantLabel: v.label,
    alsoVariants: ranked.filter((r) => r !== variant).map((r) => ({ key: r, label: kind.variants[r].label })),
    points,
    reasons,
    metrics: templates.map((t) => fillTemplate(t, vars)).filter((t): t is string => t != null),
    helpers: kind.helpers,
    partnerSupport: kind.partnerSupport,
    partnerKinds: kind.partnerKinds,
    ease: key === "wdrozenie" ? ease : null,
    fallback,
  };
}

/**
 * Rekomendacja 1–3 ścieżek: każda reguła z pathwayRules, której warunek jest spełniony, daje punkty ścieżce
 * i wariantowi oraz powód. Pokazujemy ścieżki z co najmniej minPoints (bez oceny radaru: minPointsWithoutRadar),
 * najwyżej max, od najwyższej sumy. Gdy żadna nie przekroczy progu, bierzemy najlepszą z punktami albo pathwayFallback.
 */
export function recommendPathways(x: PathwayInput): PathwayRecommendation {
  const ease = easeOfAdoption(x);
  const ctx: RuleContext = { ...x, ease: ease.score, youth: x.creatorRoles.some((r) => YOUTH_ROLES.has(r)) };
  const vars = templateVars(x, ease.score);

  const tally = new Map<PathwayKey, { points: number; variants: Map<string, number>; reasons: string[] }>();
  for (const rule of PATHWAY_RULES) {
    if (!conditionHolds(rule.when, ctx)) continue;
    const t = tally.get(rule.pathway) ?? { points: 0, variants: new Map<string, number>(), reasons: [] as string[] };
    t.points += rule.points;
    t.variants.set(rule.variant, (t.variants.get(rule.variant) ?? 0) + rule.points);
    const reason = fillTemplate(rule.reason, vars);
    if (reason) t.reasons.push(reason);
    tally.set(rule.pathway, t);
  }

  const threshold = x.radar ? PATHWAYS.minPoints : PATHWAYS.minPointsWithoutRadar;
  const byPoints = [...tally.entries()].sort((a, b) => b[1].points - a[1].points || PATHWAY_KEYS.indexOf(a[0]) - PATHWAY_KEYS.indexOf(b[0]));
  let chosen = byPoints.filter(([, t]) => t.points >= threshold).slice(0, PATHWAYS.max);
  if (chosen.length === 0 && byPoints.length > 0) chosen = byPoints.slice(0, 1);

  if (chosen.length > 0) {
    return {
      pathways: chosen.map(([key, t]) => buildPathway(key, t.variants, t.points, t.reasons, x, vars, ease, false)),
      ease,
      withRadar: !!x.radar,
    };
  }
  const [key, variant] = x.innovationKind === "technologiczna"
    ? PATHWAY_FALLBACK.technologiczna
    : x.stage === "pomysl" ? PATHWAY_FALLBACK.pomysl : PATHWAY_FALLBACK.default;
  const reasons = ["Żadna reguła nie wskazała ścieżki wyraźnie. To bezpieczny pierwszy krok dla innowacji tego typu, a zespół doprecyzuje go w rozmowie."];
  return { pathways: [buildPathway(key, new Map(), 0, reasons, x, vars, ease, true, variant)], ease, withRadar: !!x.radar };
}

/** Warunek reguły zdaniem, do tabeli na /metodologia#sciezki — strona czyta reguły wprost z konfiguracji. */
export function describeCondition(c: PathwayCondition): string {
  const parts: string[] = [];
  const kinds = (ks: string[]) => ks.map((k) => innovationKindLabel(k).toLowerCase()).join(" albo ");
  if (c.kinds) parts.push(`typ ${kinds(c.kinds)}`);
  if (c.notKinds) parts.push(`typ inny niż ${kinds(c.notKinds)}`);
  if (c.trlMin != null && c.trlMax != null) parts.push(`TRL ${c.trlMin}–${c.trlMax}`);
  else if (c.trlMin != null) parts.push(`TRL co najmniej ${c.trlMin}`);
  else if (c.trlMax != null) parts.push(`TRL najwyżej ${c.trlMax}`);
  if (c.stages) parts.push(`etap ${c.stages.map((s) => stageLabel(s).toLowerCase()).join(" albo ")}`);
  if (c.sectorPci) parts.push("sektor PCI (inny niż „inny sektor”)");
  if (c.ip) parts.push(`ochrona: ${c.ip.map((i) => ipStatusLabel(i).toLowerCase()).join(" albo ")}`);
  if (c.ipMissing) parts.push("bez ochrony");
  if (c.institutionTypes) parts.push(`instytucja: ${c.institutionTypes.map((k) => institutionLabel(k).toLowerCase()).join(" albo ")}`);
  for (const [k, v] of Object.entries(c.radarMin ?? {})) parts.push(`radar: ${RADAR.dimensions[k as RadarKey].short.toLowerCase()} co najmniej ${v}`);
  for (const [k, v] of Object.entries(c.radarMax ?? {})) parts.push(`radar: ${RADAR.dimensions[k as RadarKey].short.toLowerCase()} najwyżej ${v}`);
  if (c.easeMin != null) parts.push(`łatwość wdrożenia co najmniej ${c.easeMin}`);
  if (c.youth) parts.push("twórcy to uczniowie albo studenci");
  return parts.join(", ") || "zawsze";
}
