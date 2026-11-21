// Dopasowanie innowacji do partnerów i do instytucji z podobnym problemem (6/10). Czyste funkcje bez importów
// serwerowych — testy jednostkowe ładują ten plik wprost. Punkty i limity: config/taxonomy.json → partnerMatching.
import { sharedWords } from "../stems.ts";
import {
  PARTNER_MATCHING, domainLabel, institutionLabel, partnerKindLabel, partnerSupportLabel, pathwayLabel, sectorLabel, stageForTrl, stageLabel,
  type PartnerKindKey, type PathwayKey,
} from "../taxonomy.ts";
import type { RecommendedPathway } from "./rules.ts";

/** Wiersz partners + słowa kluczowe z search_index (kind = 'partner'). */
export type PartnerCandidate = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  description: string;
  sectors: string[];
  domains: string[];
  support: string[];
  trl_min: number | null;
  trl_max: number | null;
  stages: string[];
  keywords: string[];
  /** TERYT siedziby (gmina); null, gdy partner działa w całym regionie. */
  teryt?: string | null;
  synthetic?: boolean;
};

/** Wyzwanie z „Szukam rozwiązania”: instytucja opisała problem (karta zanonimizowana, bez kontaktu). */
export type ChallengeCandidate = {
  id: string;
  summary: string;
  keywords: string[];
  domains: string[];
  institutionType: string | null;
  /** Nazwa powiatu (bez gminy: jedna szkoła danego typu w gminie dałaby się rozpoznać). */
  county: string | null;
  synthetic?: boolean;
};

export type MatchInput = {
  innovationKind: string | null;
  stage: string | null;
  trl: number | null;
  sectors: string[];
  domains: string[];
  institutionType: string | null;
  /** TERYT gminy innowacji; partner z tego samego powiatu dostaje punkty. */
  teryt?: string | null;
  /** Słowa kluczowe karty (forma podstawowa). */
  keywords: string[];
  /** Tytuł, problem i rozwiązanie — łapią słowa, których nie ma wśród słów kluczowych. */
  text: string;
  pathways: Pick<RecommendedPathway, "key" | "partnerSupport" | "partnerKinds">[];
};

export type PartnerMatch = {
  partner: Pick<PartnerCandidate, "id" | "slug" | "name" | "kind" | "description" | "support" | "synthetic">;
  score: number;
  /** Ścieżka, której partner najbardziej pomoże. */
  pathway: PathwayKey;
  /** „Dlaczego” — zdania do pokazania przy partnerze. */
  why: string[];
};

export type ChallengeMatch = {
  challenge: ChallengeCandidate;
  score: number;
  why: string[];
  /** Powiaty instytucji z tym samym opisem problemu (jedna pozycja zamiast kilku identycznych). */
  counties: string[];
  /** Ile instytucji opisało ten problem tymi samymi słowami. */
  count: number;
};

const join = (xs: string[]) => xs.join(", ");

/** Czy partner interesuje się innowacją na tym poziomie dojrzałości: true (punkty), null (bez zdania), false (odpada). */
function maturityFit(x: MatchInput, p: PartnerCandidate): { fit: boolean | null; why: string | null } {
  const tech = x.innovationKind === "technologiczna" && x.trl != null;
  if (tech && p.trl_min != null && p.trl_max != null) {
    const ok = x.trl! >= p.trl_min && x.trl! <= p.trl_max;
    return { fit: ok, why: ok ? `TRL ${x.trl} mieści się w zakresie, który interesuje partnera (${p.trl_min}–${p.trl_max})` : null };
  }
  const stage = x.stage ?? (tech ? stageForTrl(x.trl!) : null);
  if (p.stages.length > 0 && stage) {
    const ok = p.stages.includes(stage);
    return { fit: ok, why: ok ? `Interesuje go etap „${stageLabel(stage)}”` : null };
  }
  return { fit: null, why: null };
}

/**
 * Punkty partnera (0–100) z wyjaśnieniem. null, gdy partner odpada: dojrzałość spoza jego zakresu, nie pomaga
 * w żadnej z rekomendowanych ścieżek (ani formą wsparcia, ani rodzajem) albo nie ma z innowacją nic wspólnego
 * tematycznie (sektor, dziedzina, słowa kluczowe).
 */
export function scorePartner(x: MatchInput, p: PartnerCandidate): PartnerMatch | null {
  const pts = PARTNER_MATCHING.points;
  const why: string[] = [];
  let score = 0;

  const maturity = maturityFit(x, p);
  if (maturity.fit === false) return null;

  // Ścieżka, w której partner pomaga najbardziej: najpierw wspólne formy wsparcia, potem rodzaj partnera.
  let best: { key: PathwayKey; support: string[]; kind: boolean } | null = null;
  for (const pw of x.pathways) {
    const support = p.support.filter((s) => (pw.partnerSupport as string[]).includes(s));
    const kind = (pw.partnerKinds as string[]).includes(p.kind);
    if (support.length === 0 && !kind) continue;
    if (!best || support.length > best.support.length || (support.length === best.support.length && kind && !best.kind)) {
      best = { key: pw.key, support, kind };
    }
  }
  if (!best) return null;

  const sectors = p.sectors.filter((s) => s !== "inne" && x.sectors.includes(s));
  if (sectors.length > 0) {
    score += pts.sector;
    why.push(`Ten sam sektor: ${join(sectors.map(sectorLabel))}`);
  }
  const domains = p.domains.filter((d) => x.domains.includes(d));
  if (domains.length > 0) {
    score += Math.min(pts.domainMax, domains.length * pts.domain);
    why.push(`${domains.length > 1 ? "Wspólne dziedziny" : "Wspólna dziedzina"}: ${join(domains.map(domainLabel))}`);
  }
  if (maturity.fit) {
    score += pts.maturity;
    why.push(maturity.why!);
  }
  if (best.support.length > 0) {
    score += pts.support;
    why.push(`Oferuje: ${join(best.support.map((s) => partnerSupportLabel(s).toLowerCase()))} — to pasuje do ścieżki „${pathwayLabel(best.key)}”`);
  }
  if (best.kind) {
    score += pts.kind;
    if (best.support.length === 0) why.push(`${partnerKindLabel(p.kind)} zwykle pomaga na ścieżce „${pathwayLabel(best.key)}”`);
  }
  const shared = sharedWords([...x.keywords, x.text], p.keywords);
  if (shared.length > 0) {
    score += Math.round(pts.keywords * Math.min(1, shared.length / PARTNER_MATCHING.keywordsFull));
    why.push(`Wspólne słowa: ${join(shared.slice(0, 4))}`);
  }
  // Bez związku tematycznego (sektor, dziedzina albo słowa) sama dojrzałość i forma wsparcia to za mało.
  if (sectors.length === 0 && domains.length === 0 && shared.length === 0) return null;
  if (x.teryt && p.teryt && x.teryt.slice(0, 4) === p.teryt.slice(0, 4)) {
    score += pts.county;
    why.push("Siedziba w tym samym powiecie");
  }

  return {
    partner: { id: p.id, slug: p.slug, name: p.name, kind: p.kind, description: p.description, support: p.support, synthetic: p.synthetic },
    score: Math.min(100, score),
    pathway: best.key,
    why,
  };
}

/** Ranking partnerów: od progu minScore, najwyżej perKind z każdego rodzaju i max łącznie. */
export function rankPartners(x: MatchInput, partners: PartnerCandidate[]): PartnerMatch[] {
  const scored = partners
    .map((p) => scorePartner(x, p))
    .filter((m): m is PartnerMatch => m != null && m.score >= PARTNER_MATCHING.minScore)
    .sort((a, b) => b.score - a.score || a.partner.name.localeCompare(b.partner.name, "pl"));
  const taken = new Map<string, number>();
  const out: PartnerMatch[] = [];
  for (const m of scored) {
    const n = taken.get(m.partner.kind) ?? 0;
    if (n >= (PARTNER_MATCHING.perKind[m.partner.kind as PartnerKindKey] ?? 1)) continue;
    taken.set(m.partner.kind, n + 1);
    out.push(m);
    if (out.length >= PARTNER_MATCHING.max) break;
  }
  return out;
}

/**
 * Instytucja z podobnym problemem: wspólne słowa kluczowe (bez nich wyzwanie odpada), dziedzina i ten sam typ
 * instytucji (kandydat do wdrożenia u siebie). Punkty 0–100: słowa 60, dziedzina 20, typ instytucji 20.
 */
export function scoreChallenge(x: MatchInput, c: ChallengeCandidate): ChallengeMatch | null {
  const shared = sharedWords([...x.keywords, x.text], c.keywords);
  if (shared.length === 0) return null;
  const why = [`Wspólne słowa: ${join(shared.slice(0, 4))}`];
  let score = Math.round(60 * Math.min(1, shared.length / Math.min(3, Math.max(1, c.keywords.length))));
  const domains = c.domains.filter((d) => x.domains.includes(d));
  if (domains.length > 0) {
    score += 20;
    why.push(`${domains.length > 1 ? "Wspólne dziedziny" : "Wspólna dziedzina"}: ${join(domains.map(domainLabel))}`);
  }
  if (c.institutionType && c.institutionType === x.institutionType) {
    score += 20;
    why.push(`Ten sam typ instytucji: ${institutionLabel(c.institutionType).toLowerCase()} — może wdrożyć to u siebie`);
  }
  return { challenge: c, score, why, counties: c.county ? [c.county] : [], count: 1 };
}

/** Ranking wyzwań od progu challengeMinScore; ten sam opis z kilku instytucji to jedna pozycja z listą powiatów. */
export function rankChallenges(x: MatchInput, challenges: ChallengeCandidate[]): ChallengeMatch[] {
  const bySummary = new Map<string, ChallengeMatch>();
  for (const c of challenges) {
    const m = scoreChallenge(x, c);
    if (!m || m.score < PARTNER_MATCHING.challengeMinScore) continue;
    const key = c.summary.trim().toLowerCase();
    const seen = bySummary.get(key);
    if (!seen) {
      bySummary.set(key, m);
      continue;
    }
    seen.count += 1;
    if (c.county && !seen.counties.includes(c.county)) seen.counties.push(c.county);
  }
  return [...bySummary.values()].sort((a, b) => b.score - a.score || b.count - a.count).slice(0, PARTNER_MATCHING.challengeMax);
}

/** Rodzaje partnerów w kolejności pokazywania (firmy, finansowanie, wsparcie, samorządy). */
export const PARTNER_GROUPS: { label: string; kinds: PartnerKindKey[] }[] = [
  { label: "Firmy", kinds: ["firma"] },
  { label: "Finansowanie", kinds: ["fundusz"] },
  { label: "Wsparcie: PCI i transfer technologii", kinds: ["pci", "ctt"] },
  { label: "Samorządy jako odbiorcy", kinds: ["jst"] },
];
