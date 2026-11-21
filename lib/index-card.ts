import "server-only";
import { tagCard } from "./llm";
import { InitiativeCard, type CardKind } from "./schemas";
import { upsertIndex } from "./search";
import { createAdminClient } from "./supabase/admin";

type Source = {
  title: string;
  body: string;
  teryt: string | null;
  active: boolean;
  institutionType?: string | null;
  tags?: string[];
  // Gdy karta ma już lematy i dziedziny (np. inicjatywa z intake), nie wołamy LLM.
  lemmas?: string[];
  domains?: string[];
};

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join("\n");

/** Tekst karty z tabeli domenowej — indeksujemy to, co jest w bazie, nie to, co przysłał klient. */
async function loadSource(kind: CardKind, refId: string): Promise<Source | null> {
  const supabase = createAdminClient();
  switch (kind) {
    case "pattern": {
      const { data, error } = await supabase
        .from("patterns")
        .select("title, problem, solution, beneficiaries, who_can_use, domains, cross_topics, published")
        .eq("id", refId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        title: data.title,
        body: join(data.problem, data.solution, data.beneficiaries, data.who_can_use),
        teryt: null,
        active: data.published,
        tags: data.cross_topics ?? [],
        // Dziedziny nadane w Panelu albo regułami seedu mają pierwszeństwo przed LLM; lematy zawsze z LLM.
        domains: data.domains?.length ? data.domains : undefined,
      };
    }
    case "initiative": {
      const { data, error } = await supabase
        .from("initiatives")
        .select("card, teryt, status, duplicate_of, innovation_kind, sectors")
        .eq("id", refId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // Tylko pola indeksu: karty sprzed nowych pól (0007) też przechodzą.
      const card = InitiativeCard.pick({ title: true, problem: true, solution: true, institutionType: true, stage: true, cross: true, keywords: true, domains: true }).parse(data.card);
      return {
        title: card.title,
        body: `${card.problem} ${card.solution}`, // już zanonimizowane w intake
        teryt: data.teryt,
        active: data.status !== "archived" && !data.duplicate_of,
        institutionType: card.institutionType,
        tags: [card.stage, ...(data.innovation_kind ? [data.innovation_kind] : []), ...(data.sectors ?? []), ...card.cross],
        lemmas: card.keywords,
        domains: [...card.domains],
      };
    }
    case "mentor": {
      const { data, error } = await supabase.from("mentors").select("name, bio, expertise, domains, active").eq("id", refId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        title: data.name, body: data.bio, teryt: null, active: data.active,
        lemmas: data.expertise?.length ? data.expertise : undefined, domains: data.domains ?? [],
      };
    }
    case "program": {
      const { data, error } = await supabase.from("programs").select("title, description, domains, active").eq("id", refId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { title: data.title, body: join(data.title, data.description), teryt: null, active: data.active, domains: data.domains?.length ? data.domains : undefined };
    }
    case "partner": {
      const { data, error } = await supabase.from("partners").select("name, description, kind, sectors, domains, active").eq("id", refId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        title: data.name, body: join(data.name, data.description), teryt: null, active: data.active,
        tags: [data.kind, ...(data.sectors ?? [])], domains: data.domains?.length ? data.domains : undefined,
      };
    }
    default:
      return null; // challenge indeksuje lib/challenge-search.ts przy zapisie; domain i material — lib/knowledge/indexing.ts; source_record — seed 40_sources.sql i lib/sources.ts
  }
}

/** Reindeks karty po zapisie: lematy i dziedziny (LLM), upsert do search_index. Zwraca false, gdy karty nie ma w bazie. */
export async function reindexCard(kind: CardKind, refId: string): Promise<boolean> {
  const source = await loadSource(kind, refId);
  if (!source) return false;

  const tags = !source.lemmas || !source.domains ? await tagCard(source.title, source.body) : null;

  await upsertIndex({
    kind,
    refId,
    title: source.title,
    body: source.body,
    lemmas: source.lemmas ?? tags?.lemmas ?? [],
    domains: source.domains ?? tags?.domains ?? [],
    tags: source.tags,
    institutionType: source.institutionType ?? null,
    teryt: source.teryt,
    active: source.active,
  });
  return true;
}
