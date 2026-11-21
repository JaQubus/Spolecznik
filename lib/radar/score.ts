// Ocena radaru (5/10): twarde reguły i sygnał. Czyste funkcje bez importów serwerowych i bez aliasu „@/”,
// żeby testy jednostkowe (node --test --experimental-strip-types) ładowały ten plik wprost.
// Te same reguły i wagi stosuje seed danych demo: data/seed_initiatives.py → assess().
import {
  RADAR, RADAR_KEYS, INNOVATION_KIND_KEYS, innovationKindLabel, ipStatusLabel, sectorLabel, stageLabel, trlLabel,
  type RadarKey, type RadarWeightsKey, type StageKey,
} from "../taxonomy.ts";

/** opis: ocena oparta na treści karty · brak_danych: karta nic o tym nie mówi (ocena najwyżej noDataMax). */
export type RadarBasis = "opis" | "brak_danych";

/** Ocena jednego wymiaru od modelu, przed regułami. */
export type RawDimension = { score: number; why: string; evidence: string; basis: RadarBasis };

export type RadarDimensionResult = {
  score: number;
  why: string;
  /** Dosłowny fragment karty, na którym opiera się ocena; null, gdy go nie ma albo nie znaleźliśmy go w karcie. */
  evidence: string | null;
  basis: RadarBasis;
  /** Reguły, które zmieniły ocenę modelu — zdania do pokazania w Panelu i na karcie. */
  rules: string[];
};

/** Zapis w initiatives.radar. */
export type RadarAssessment = {
  dimensions: Record<RadarKey, RadarDimensionResult>;
  strengths: string[];
  risks: string[];
  /** Część wymiarów ocenionych na podstawie opisu (0–1). */
  confidence: number;
  signal: number;
  /** Zestaw wag, z którego policzono sygnał. */
  weights: RadarWeightsKey;
  methodology: number;
  model: string;
  assessedAt: string;
};

/** Kontekst reguł: to, co wiemy o inicjatywie niezależnie od modelu. */
export type RadarContext = {
  stage: StageKey | string | null;
  innovationKind: string | null;
  trl: number | null;
  /** Tekst karty, w którym szukamy cytatów (tytuł, streszczenie, problem, rozwiązanie, efekty, odbiorcy). */
  cardText: string;
};

const clamp = (n: number) => Math.min(5, Math.max(0, Math.round(n)));

/** Porównanie cytatu z kartą bez różnic w wielkości liter, odstępach, cudzysłowach i myślnikach. */
export function normalizeQuote(s: string): string {
  return s
    .toLowerCase()
    .replace(/[„”“"'«»‚‘’]/g, "")
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:!?…-]+|[\s.,;:!?…-]+$/g, "")
    .trim();
}

/** Dłuższy cytat może różnić się od karty drobną odmianą („o połowie” zamiast „o połowę”) — do tej części słów. */
export const QUOTE_WORD_TOLERANCE = 0.15;
const QUOTE_FUZZY_MIN_WORDS = 4;
const words = (s: string) => s.match(/[\p{L}\p{N}%]+/gu) ?? [];

/**
 * Cytat jest prawdziwy, gdy (po normalizacji) każda jego część — wielokropek dzieli na części — ma co najmniej 3 znaki
 * i występuje w karcie dosłownie, a część od 4 słów: gdy najwyżej 15% jej słów nie ma w karcie. Parafraza nie przejdzie.
 */
export function quoteInCard(quote: string, cardText: string): boolean {
  const card = normalizeQuote(cardText);
  const cardWords = new Set(words(card));
  const parts = quote.split(/…|\.\.\./).map(normalizeQuote).filter((p) => p.length > 0);
  return parts.length > 0 && parts.every((p) => {
    if (p.length < 3) return false;
    if (card.includes(p)) return true;
    const w = words(p);
    return w.length >= QUOTE_FUZZY_MIN_WORDS && w.filter((x) => !cardWords.has(x)).length / w.length <= QUOTE_WORD_TOLERANCE;
  });
}

export function weightsKey(innovationKind: string | null): RadarWeightsKey {
  return (INNOVATION_KIND_KEYS as readonly string[]).includes(innovationKind ?? "") ? (innovationKind as RadarWeightsKey) : "domyslne";
}

/** Najwyższa dopuszczalna ocena dojrzałości: z etapu i — dla technologii — z poziomu TRL. */
export function maturityCap(ctx: Pick<RadarContext, "stage" | "innovationKind" | "trl">): { cap: number; reason: string | null } {
  let cap = 5;
  let reason: string | null = null;
  const byStage = ctx.stage ? RADAR.maturityCap[ctx.stage as StageKey] : undefined;
  if (byStage != null && byStage < cap) {
    cap = byStage;
    reason = `etap „${stageLabel(ctx.stage!)}” pozwala najwyżej na ${byStage}`;
  }
  const byTrl = ctx.innovationKind === "technologiczna" && ctx.trl != null ? RADAR.trlMaturityCap[String(ctx.trl)] : undefined;
  if (byTrl != null && byTrl < cap) {
    cap = byTrl;
    reason = `TRL ${ctx.trl} pozwala najwyżej na ${byTrl}`;
  }
  return { cap, reason };
}

/**
 * Reguły po ocenie modelu, w tej kolejności:
 * 1. cytat, którego nie ma w karcie (albo pusty) ⇒ brak_danych — model nie może oprzeć oceny na czymś, czego nie napisano;
 * 2. brak_danych ⇒ ocena najwyżej noDataMax;
 * 3. dojrzałość najwyżej tyle, ile pozwala etap, a dla technologii także TRL;
 * 4. inicjatywa przeniesiona ⇒ skalowalność co najmniej transferredMinScalability (przeniesienie to dowód).
 * Brakujący wymiar w odpowiedzi modelu = brak_danych z oceną 0.
 */
export function applyRules(raw: Partial<Record<RadarKey, RawDimension>>, ctx: RadarContext): Record<RadarKey, RadarDimensionResult> {
  const out = {} as Record<RadarKey, RadarDimensionResult>;
  for (const key of RADAR_KEYS) {
    const r = raw[key];
    const rules: string[] = [];
    let score = clamp(r?.score ?? 0);
    let basis: RadarBasis = r?.basis ?? "brak_danych";
    let evidence: string | null = r?.evidence?.trim() || null;
    if (!r) rules.push("Model nie ocenił tego wymiaru.");

    if (basis === "opis" && !(evidence && quoteInCard(evidence, ctx.cardText))) {
      basis = "brak_danych";
      rules.push(evidence ? "Cytatu nie ma w karcie, więc ocena liczy się jak brak danych." : "Brak cytatu z karty, więc ocena liczy się jak brak danych.");
      evidence = null;
    }
    if (basis === "brak_danych") {
      if (evidence && !quoteInCard(evidence, ctx.cardText)) evidence = null;
      if (score > RADAR.noDataMax) {
        rules.push(`Karta nic o tym nie mówi: ocena obniżona z ${score} do ${RADAR.noDataMax}.`);
        score = RADAR.noDataMax;
      }
    }
    if (key === "dojrzalosc") {
      const { cap, reason } = maturityCap(ctx);
      if (score > cap) {
        rules.push(`Ocena obniżona z ${score} do ${cap}: ${reason}.`);
        score = cap;
      }
    }
    if (key === "skalowalnosc" && ctx.stage === "przeniesiona" && score < RADAR.transferredMinScalability) {
      rules.push(`Ocena podniesiona z ${score} do ${RADAR.transferredMinScalability}: inicjatywa działa już w innym miejscu.`);
      score = RADAR.transferredMinScalability;
    }
    out[key] = { score, why: r?.why?.trim() ?? "", evidence, basis, rules };
  }
  return out;
}

/** Sygnał 0–100: suma wag zestawu × ocena / 5. */
export function radarSignal(dims: Record<RadarKey, { score: number }>, innovationKind: string | null): number {
  const w = RADAR.weights[weightsKey(innovationKind)];
  return Math.round(100 * RADAR_KEYS.reduce((sum, k) => sum + w[k] * (dims[k]?.score ?? 0) / 5, 0));
}

export function radarConfidence(dims: Record<RadarKey, { basis: RadarBasis }>): number {
  return Math.round((RADAR_KEYS.filter((k) => dims[k]?.basis === "opis").length / RADAR_KEYS.length) * 100) / 100;
}

/** Cała ocena z odpowiedzi modelu: reguły, sygnał, pewność i metryka wersji. */
export function buildAssessment(
  raw: Partial<Record<RadarKey, RawDimension>>,
  ctx: RadarContext,
  meta: { strengths: string[]; risks: string[]; model: string; assessedAt: string },
): RadarAssessment {
  const dimensions = applyRules(raw, ctx);
  return {
    dimensions,
    strengths: meta.strengths,
    risks: meta.risks,
    confidence: radarConfidence(dimensions),
    signal: radarSignal(dimensions, ctx.innovationKind),
    weights: weightsKey(ctx.innovationKind),
    methodology: RADAR.methodologyVersion,
    model: meta.model,
    assessedAt: meta.assessedAt,
  };
}

/** Karta do oceny: pola treściowe i klasyfikacja, bez pól roboczych intake. */
export type RadarCardInput = {
  title: string; summary: string; problem: string; solution: string; effects: string | null; beneficiaries: string | null;
  stage: string | null; innovationKind: string | null; sectors: string[]; trl: number | null; ipStatus: string | null;
};

/**
 * Linie karty, które dostaje model w <karta> — i ten sam tekst, w którym szukamy cytatów. Dzięki temu cytat
 * „Etap: Pilotaż” albo „TRL 4: model sprawdzony w laboratorium” też jest dowodem z karty.
 */
export function radarCardLines(c: RadarCardInput): string[] {
  return [
    `Tytuł: ${c.title}`, `Streszczenie: ${c.summary}`, `Problem: ${c.problem}`, `Rozwiązanie: ${c.solution}`,
    `Efekty: ${c.effects ?? "brak informacji"}`, `Dla kogo: ${c.beneficiaries ?? "brak informacji"}`,
    `Etap: ${c.stage ? stageLabel(c.stage) : "nieznany"}`, `Typ innowacji: ${c.innovationKind ? innovationKindLabel(c.innovationKind) : "nieznany"}`,
    `Sektory: ${c.sectors.map(sectorLabel).join(", ") || "brak"}`, `Gotowość technologii: ${c.trl != null ? trlLabel(c.trl) : "nie dotyczy"}`,
    `Ochrona IP: ${c.ipStatus ? ipStatusLabel(c.ipStatus) : "brak informacji"}`,
  ];
}

/** Karta z initiatives.card i kolumn klasyfikacji. */
export function radarCardInput(
  card: Record<string, unknown>,
  cols: { stage: string | null; innovation_kind: string | null; sectors: string[] | null; trl: number | null; ip_status: string | null },
): RadarCardInput {
  const str = (k: string) => (typeof card[k] === "string" ? (card[k] as string) : "");
  return {
    title: str("title"), summary: str("summary"), problem: str("problem"), solution: str("solution"),
    effects: str("effects") || null, beneficiaries: str("beneficiaries") || null,
    stage: cols.stage, innovationKind: cols.innovation_kind, sectors: cols.sectors ?? [], trl: cols.trl, ipStatus: cols.ip_status,
  };
}

/** Odczyt initiatives.radar z bazy: stara ocena (metodologia 1, inne klucze) daje null zamiast wyjątku na stronie. */
export function readAssessment(value: unknown): RadarAssessment | null {
  const v = value as Partial<RadarAssessment> | null;
  if (!v || typeof v !== "object" || !v.dimensions) return null;
  if (!RADAR_KEYS.every((k) => v.dimensions![k] && typeof v.dimensions![k].score === "number")) return null;
  return {
    ...v,
    strengths: v.strengths ?? [],
    risks: v.risks ?? [],
    dimensions: Object.fromEntries(RADAR_KEYS.map((k) => {
      const d = v.dimensions![k] as Partial<RadarDimensionResult> & { score: number };
      return [k, { score: d.score, why: d.why ?? "", evidence: d.evidence ?? null, basis: d.basis ?? "opis", rules: d.rules ?? [] }];
    })) as RadarAssessment["dimensions"],
  } as RadarAssessment;
}
