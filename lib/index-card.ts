import "server-only";
import { tagCard } from "./llm";
import { anonymize } from "./pii";
import { Fiszka, NeedCard, type CardKind } from "./schemas";
import { upsertIndex } from "./search";
import { createAdminClient } from "./supabase/admin";

type Source = {
  title: string;
  body: string;
  teryt: string | null;
  active: boolean;
  // Gdy karta ma już lematy i tagi (np. potrzeba z intake), nie wołamy LLM.
  lemmas?: string[];
  areas?: string[];
  groups?: string[];
};

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join("\n");

/** Tekst karty z tabeli domenowej — indeksujemy to, co jest w bazie, nie to, co przysłał klient. */
async function loadSource(kind: CardKind, refId: string): Promise<Source | null> {
  const supabase = createAdminClient();
  switch (kind) {
    case "innowacja": {
      const { data, error } = await supabase
        .from("innovations")
        .select("title, problem, solution, beneficiaries, who_can_use, areas, target_groups")
        .eq("id", refId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        title: data.title,
        body: join(data.problem, data.solution, data.beneficiaries, data.who_can_use),
        teryt: null,
        active: true,
        // Tagi nadane w Panelu albo przez enrich.py mają pierwszeństwo przed LLM.
        areas: data.areas?.length ? data.areas : undefined,
        groups: data.target_groups?.length ? data.target_groups : undefined,
      };
    }
    case "potrzeba": {
      const { data, error } = await supabase
        .from("needs")
        .select("card, teryt, status")
        .eq("id", refId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const card = NeedCard.parse(data.card);
      return {
        title: card.summary.slice(0, 140),
        body: card.summary, // już zanonimizowane w intake
        teryt: data.teryt,
        active: data.status !== "zamkniete",
        lemmas: card.keywords,
        areas: [...card.areas],
        groups: [...card.groups],
      };
    }
    case "pomysl": {
      const { data, error } = await supabase
        .from("ideas")
        .select("fiszka, status")
        .eq("id", refId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const fiszka = Fiszka.parse(data.fiszka);
      return {
        title: anonymize(fiszka.krotki_opis).text.slice(0, 140),
        body: anonymize(join(fiszka.krotki_opis, fiszka.istota, fiszka.dla_kogo)).text,
        teryt: null,
        active: data.status !== "zamkniete",
      };
    }
    case "ekspert": {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, expertise, teryt")
        .eq("id", refId)
        .eq("role", "ekspert")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        title: data.display_name ?? "Ekspert",
        body: (data.expertise ?? []).join(", "),
        teryt: data.teryt,
        active: true,
      };
    }
    case "nabor": {
      const { data, error } = await supabase
        .from("calls")
        .select("title, description, active")
        .eq("id", refId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { title: data.title, body: join(data.title, data.description), teryt: null, active: data.active };
    }
    default:
      return null; // biblioteka, obszar, material: karty Zasobnika indeksuje lib/knowledge/indexing.ts
  }
}

/**
 * Reindeks karty po zapisie (README 5.3): lematy i tagi (LLM), upsert do search_index.
 * Zwraca false, gdy karty nie ma w bazie.
 */
export async function reindexCard(kind: CardKind, refId: string): Promise<boolean> {
  const source = await loadSource(kind, refId);
  if (!source) return false;

  const tags = !source.lemmas || !source.areas ? await tagCard(source.title, source.body) : null;

  await upsertIndex({
    kind,
    refId,
    title: source.title,
    body: source.body,
    lemmas: source.lemmas ?? tags?.lemmas ?? [],
    areas: source.areas ?? tags?.areas ?? [],
    targetGroups: source.groups ?? tags?.groups ?? [],
    teryt: source.teryt,
    active: source.active,
  });
  return true;
}
