import "server-only";
import { knowledge } from "./index";
import { normalize } from "./text-search";
import type { Pattern } from "./types";

/**
 * „Podobne rozwiązania”: wspólne dziedziny, tematy przekrojowe i słowa w opisie problemu (prosta miara Jaccarda
 * na rdzeniach). Bez embeddingów (tylko Groq).
 */
export async function similarPatterns(p: Pattern, count = 3): Promise<Pattern[]> {
  const all = (await knowledge.patterns()).filter((x) => x.id !== p.id);
  const stems = (x: Pattern) =>
    new Set(normalize(`${x.title} ${x.problem ?? ""} ${x.beneficiaries ?? ""}`).split(/\s+/).filter((w) => w.length > 4).map((w) => w.slice(0, 6)));
  const mine = stems(p);
  const score = (x: Pattern) => {
    const theirs = stems(x);
    const common = [...mine].filter((s) => theirs.has(s)).length;
    const jaccard = common / (mine.size + theirs.size - common || 1);
    return jaccard + 0.3 * x.domains.filter((d) => p.domains.includes(d)).length + 0.3 * x.crossTopics.filter((c) => p.crossTopics.includes(c)).length;
  };
  return all.map((x) => ({ x, s: score(x) })).sort((a, b) => b.s - a.s).slice(0, count).map((r) => r.x);
}
