import "server-only";
import { AREA_LABELS, GROUP_LABELS } from "@/lib/taxonomy";
import { knowledge } from "./index";
import { areaRefId, canUseHybridSearch, lemmatize } from "./indexing";
import { MATERIAL_KIND_LABELS, TYPE_LABELS } from "./labels";
import { queryStems, scoreDocument } from "./text-search";
import type { Area, Innovation, Material } from "./types";

export type KnowledgeResults = {
  query: string;
  areas: Area[];
  innovations: Innovation[];
  materials: Material[];
  /** „hybryda” = embeddingi + słowa (jak matchmaking); „słowa” = tryb bez kluczy API. */
  engine: "hybryda" | "słowa";
};

const LIMITS = { areas: 3, innovations: 9, materials: 4 };

/** „O czym chcesz się dowiedzieć?” — jedno zapytanie, wyniki w trzech grupach. */
export async function searchKnowledge(query: string): Promise<KnowledgeResults> {
  const q = query.trim().slice(0, 300);
  if (q.length < 2) return { query: q, areas: [], innovations: [], materials: [], engine: "słowa" };
  if (canUseHybridSearch()) {
    try {
      return await hybrid(q);
    } catch (e) {
      console.error("[knowledge/search] hybryda nieudana, szukam po słowach:", e);
    }
  }
  return textSearch(q);
}

async function textSearch(q: string): Promise<KnowledgeResults> {
  const groups = queryStems(q);
  const [areas, innovations, materials] = await Promise.all([knowledge.areas(), knowledge.innovations(), knowledge.materials()]);
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
    areas: rank(areas, (a) => [
      { text: a.name, weight: 4 }, { text: a.lead, weight: 3 }, { text: a.definition, weight: 2 },
      { text: a.challenges.join(" "), weight: 1 },
    ], LIMITS.areas),
    innovations: rank(innovations, (i) => [
      { text: i.title, weight: 4 }, { text: i.problem, weight: 2 }, { text: i.solution, weight: 2 },
      { text: i.beneficiaries, weight: 2 }, { text: i.whoCanUse, weight: 1 }, { text: i.etrSummary, weight: 2 },
      { text: i.groups.map((g) => GROUP_LABELS[g]).join(" "), weight: 2 },
      { text: i.areas.map((a) => AREA_LABELS[a]).join(" "), weight: 1 },
      { text: i.innovationType && TYPE_LABELS[i.innovationType], weight: 1 },
    ], LIMITS.innovations),
    materials: rank(materials, (m) => [
      { text: m.title, weight: 3 }, { text: m.description, weight: 2 }, { text: MATERIAL_KIND_LABELS[m.kind], weight: 2 },
      { text: m.areas.map((a) => AREA_LABELS[a]).join(" "), weight: 1 },
    ], LIMITS.materials),
  };
}

async function hybrid(q: string): Promise<KnowledgeResults> {
  const { embedText, hybridSearch } = await import("@/lib/search");
  const [keywords, embedding] = await Promise.all([lemmatize(q, 8), embedText(q)]);
  const [areaHits, innovationHits, materialHits] = await Promise.all([
    hybridSearch("obszar", keywords, embedding, LIMITS.areas),
    hybridSearch("biblioteka", keywords, embedding, LIMITS.innovations),
    hybridSearch("material", keywords, embedding, LIMITS.materials),
  ]);
  const [areas, innovations, materials] = await Promise.all([knowledge.areas(), knowledge.innovations(), knowledge.materials()]);
  // Obszary i materiały bez progu podobieństwa wyskakiwałyby przy każdym pytaniu — odcinamy słabe trafienia.
  const pick = <T extends { id?: string; key?: string }>(rows: T[], hits: { ref_id: string; similarity: number }[], min: number, id: (t: T) => string) =>
    hits.filter((h) => h.similarity >= min).flatMap((h) => rows.filter((r) => id(r) === h.ref_id));
  return {
    query: q,
    engine: "hybryda",
    areas: pick(areas, areaHits, 0.3, (a) => areaRefId(a.key)),
    innovations: pick(innovations, innovationHits, 0, (i) => i.id),
    materials: pick(materials, materialHits, 0.3, (m) => m.id),
  };
}
