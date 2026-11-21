// Widok ścieżek dla jednej innowacji: reguły + partnerzy + wyzwania + (jeśli jest) uzasadnienie od modelu.
// Czysta funkcja — te same dane widzą karta publiczna, Panel, rozmowa twórcy i wynik zgłoszenia.
import { readAssessment } from "../radar/score.ts";
import { readStoredPathways, type PathwayNarrativeItem } from "../schemas.ts";
import { contentWords, sameStem } from "../stems.ts";
import type { PathwayKey } from "../taxonomy.ts";
import { rankChallenges, rankPartners, type ChallengeCandidate, type ChallengeMatch, type MatchInput, type PartnerCandidate, type PartnerMatch } from "./match.ts";
import { recommendPathways, type PathwayRecommendation } from "./rules.ts";

/** Kolumny inicjatywy (initiatives albo public_initiatives) potrzebne do ścieżek. */
export type PathwaySource = {
  innovation_kind: string | null;
  stage: string | null;
  trl: number | null;
  sectors: string[];
  ip_status: string | null;
  institution_type: string | null;
  domains: string[];
  teryt: string | null;
  adoptions_count?: number | null;
  card: { title?: string; problem?: string; solution?: string; keywords?: string[]; creatorRoles?: string[] } | null;
  radar: unknown;
  pathways?: unknown;
};

export type MatchCandidates = { partners: PartnerCandidate[]; challenges: ChallengeCandidate[] };

export type PathwaysView = {
  recommendation: PathwayRecommendation;
  /** Uzasadnienie i kroki od modelu dla ścieżek, które nadal wybierają reguły. */
  narrative: Partial<Record<PathwayKey, PathwayNarrativeItem>>;
  narrativeMeta: { model: string; generatedAt: string } | null;
  partners: PartnerMatch[];
  challenges: ChallengeMatch[];
};

/** Od tej części słów treściowych miernik od AI uznajemy za powtórzenie miernika z konfiguracji (albo wcześniejszego). */
export const METRIC_REPEAT = 0.5;

/**
 * Mierniki od AI bez powtórzeń: model mimo zakazu w prompcie przepisuje mierniki z konfiguracji innymi słowami
 * („List intencyjny od firmy… do 6 miesiąca” obok „List intencyjny z firmą z sektora w 6 miesięcy”).
 */
export function extraMetrics(configured: string[], fromAi: string[]): string[] {
  const kept: string[] = [];
  for (const m of fromAi) {
    const words = contentWords(m);
    const repeats = (other: string) => {
      const theirs = contentWords(other);
      return words.length > 0 && words.filter((w) => theirs.some((t) => sameStem(w, t))).length / words.length >= METRIC_REPEAT;
    };
    if (![...configured, ...kept].some(repeats)) kept.push(m);
  }
  return kept;
}

export function matchInput(src: PathwaySource, pathways: PathwayRecommendation["pathways"]): MatchInput {
  const card = src.card ?? {};
  return {
    innovationKind: src.innovation_kind,
    stage: src.stage,
    trl: src.trl,
    sectors: src.sectors ?? [],
    domains: src.domains ?? [],
    institutionType: src.institution_type,
    teryt: src.teryt,
    keywords: card.keywords ?? [],
    text: [card.title, card.problem, card.solution].filter(Boolean).join(" "),
    pathways,
  };
}

export function recommendationFor(src: PathwaySource): PathwayRecommendation {
  const radar = readAssessment(src.radar);
  return recommendPathways({
    innovationKind: src.innovation_kind,
    stage: src.stage,
    trl: src.trl,
    sectors: src.sectors ?? [],
    ipStatus: src.ip_status,
    institutionType: src.institution_type,
    creatorRoles: src.card?.creatorRoles ?? [],
    radar,
    adoptionsCount: src.adoptions_count ?? 0,
  });
}

export function buildPathwaysView(src: PathwaySource, candidates: MatchCandidates): PathwaysView {
  const recommendation = recommendationFor(src);
  const input = matchInput(src, recommendation.pathways);
  const stored = readStoredPathways(src.pathways);
  const narrative: PathwaysView["narrative"] = {};
  for (const item of stored?.items ?? []) {
    const pathway = recommendation.pathways.find((p) => p.key === item.key);
    if (pathway) narrative[item.key] = { ...item, metrics: extraMetrics(pathway.metrics, item.metrics) };
  }
  return {
    recommendation,
    narrative,
    narrativeMeta: stored ? { model: stored.model, generatedAt: stored.generatedAt } : null,
    partners: rankPartners(input, candidates.partners),
    challenges: rankChallenges(input, candidates.challenges),
  };
}
