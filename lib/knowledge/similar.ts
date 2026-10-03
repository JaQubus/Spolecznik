import "server-only";
import { knowledge } from "./index";
import { normalize } from "./text-search";
import type { Innovation } from "./types";

/**
 * „Podobne innowacje”: wspólne obszary, kategorie i słowa w opisie problemu (prosta miara Jaccarda
 * na rdzeniach). Bez embeddingów (tylko Groq), więc bez similar_cards.
 */
export async function similarInnovations(i: Innovation, count = 3): Promise<Innovation[]> {
  const all = (await knowledge.innovations()).filter((x) => x.id !== i.id);
  const stems = (x: Innovation) =>
    new Set(normalize(`${x.title} ${x.problem ?? ""} ${x.beneficiaries ?? ""}`).split(/\s+/).filter((w) => w.length > 4).map((w) => w.slice(0, 6)));
  const mine = stems(i);
  const score = (x: Innovation) => {
    const theirs = stems(x);
    const common = [...mine].filter((s) => theirs.has(s)).length;
    const jaccard = common / (mine.size + theirs.size - common || 1);
    return jaccard + 0.3 * x.areas.filter((a) => i.areas.includes(a)).length + 0.5 * x.groups.filter((g) => i.groups.includes(g)).length;
  };
  return all.map((x) => ({ x, s: score(x) })).sort((a, b) => b.s - a.s).slice(0, count).map((r) => r.x);
}
