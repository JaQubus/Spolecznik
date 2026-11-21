import "server-only";
import { crossLabel, domainLabel, institutionLabel } from "@/lib/taxonomy";
import { knowledge } from "./index";
import { MATERIAL_KIND_LABELS, TYPE_LABELS } from "./labels";
import { queryStems, scoreDocument } from "./text-search";
import type { Domain, Material, Pattern } from "./types";

export type KnowledgeResults = {
  query: string;
  domains: Domain[];
  patterns: Pattern[];
  materials: Material[];
  /** Zawsze „słowa”: bez embeddingów (tylko Groq) szukamy po słowach w danych. */
  engine: "słowa";
};

const LIMITS = { domains: 3, patterns: 9, materials: 4 };

/** „O czym chcesz się dowiedzieć?” — jedno zapytanie, wyniki w trzech grupach. */
export async function searchKnowledge(query: string): Promise<KnowledgeResults> {
  const q = query.trim().slice(0, 300);
  if (q.length < 2) return { query: q, domains: [], patterns: [], materials: [], engine: "słowa" };
  return textSearch(q);
}

async function textSearch(q: string): Promise<KnowledgeResults> {
  const groups = queryStems(q);
  const [domains, patterns, materials] = await Promise.all([knowledge.domains(), knowledge.patterns(), knowledge.materials()]);
  // Wymagamy trafienia większości słów z zapytania (przy 1–2 słowach: wszystkich), żeby nie zalać wyników.
  const needed = groups.length <= 2 ? groups.length : Math.ceil(groups.length / 2);
  const rank = <T,>(items: T[], fields: (t: T) => { text: string | null | undefined; weight: number }[], limit: number) =>
    items
      .map((item) => {
        const f = fields(item);
        const matched = groups.filter((g) => scoreDocument([g], f) > 0).length;
        return { item, matched, score: scoreDocument(groups, f) };
      })
      .filter((r) => r.matched >= needed && r.score > 0)
      .sort((a, b) => b.matched - a.matched || b.score - a.score)
      .slice(0, limit)
      .map((r) => r.item);

  return {
    query: q,
    engine: "słowa",
    domains: rank(domains, (d) => [
      { text: d.name, weight: 4 }, { text: d.lead, weight: 3 }, { text: d.definition, weight: 2 },
      { text: d.challenges.join(" "), weight: 1 },
    ], LIMITS.domains),
    patterns: rank(patterns, (p) => [
      { text: p.title, weight: 4 }, { text: p.problem, weight: 2 }, { text: p.solution, weight: 2 },
      { text: p.beneficiaries, weight: 2 }, { text: p.whoCanUse, weight: 1 }, { text: p.etrSummary, weight: 2 },
      { text: p.domains.map(domainLabel).join(" "), weight: 1 },
      { text: p.crossTopics.map(crossLabel).join(" "), weight: 1 },
      { text: p.institutionTypes.map(institutionLabel).join(" "), weight: 1 },
      { text: p.innovationType && TYPE_LABELS[p.innovationType], weight: 1 },
    ], LIMITS.patterns),
    materials: rank(materials, (m) => [
      { text: m.title, weight: 3 }, { text: m.description, weight: 2 }, { text: MATERIAL_KIND_LABELS[m.kind], weight: 2 },
      { text: m.domains.map(domainLabel).join(" "), weight: 1 },
    ], LIMITS.materials),
  };
}
