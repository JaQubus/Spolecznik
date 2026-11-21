import "server-only";
import { rerank, type Candidate } from "./llm";
import { RELATED_MIN_SIMILARITY, type Match, type MentorHit, type ProgramHit, type RerankItem, type SourceKind } from "./schemas";
import { keywordSearch } from "./search";
import { contentStems, stem, words } from "./stems";
import { createAdminClient } from "./supabase/admin";

/**
 * Wspólne kroki dopasowania dla „Szukam rozwiązania” (lib/challenge-search.ts) i inspiracji przy zgłoszeniu
 * inicjatywy (lib/initiatives/create.ts): kandydaci po PROBLEMIE → rerank LLM → siatka bezpieczeństwa → szczegóły.
 */

const CANDIDATES = 15;
/** Od tej części słów opisu znalezionych w problemie kandydat zawsze trafia do reranku. */
const STRONG_OVERLAP = 0.6;
/** Opis prawie dosłownie powtarza problem kandydata — wtedy nie może skończyć się luką. */
const VERBATIM_OVERLAP = 0.85;
const VERBATIM_MIN_WORDS = 4;

export type Lexical = { candidate: Candidate; kind: SourceKind; overlap: number; score: number };

type Doc = { id: string; kind: SourceKind; title: string; body: string };

/** Problemy kandydatów: sprawdzone rozwiązania (patterns.problem) i opublikowane inicjatywy (karta: problem). */
async function loadDocs(kinds: SourceKind[]): Promise<Doc[]> {
  const supabase = createAdminClient();
  const [patterns, initiatives] = await Promise.all([
    kinds.includes("pattern")
      ? supabase.from("patterns").select("id, title, problem").eq("published", true).not("problem", "is", null).limit(500)
      : { data: [], error: null },
    // Widok public_initiatives: tylko opublikowane i bez danych kontaktowych.
    kinds.includes("initiative")
      ? supabase.from("public_initiatives").select("id, title, card").limit(1000)
      : { data: [], error: null },
  ]);
  if (patterns.error) throw patterns.error;
  if (initiatives.error) throw initiatives.error;
  return [
    ...(patterns.data ?? []).map((p) => ({ id: p.id as string, kind: "pattern" as const, title: p.title as string, body: (p.problem as string).trim() })),
    ...(initiatives.data ?? []).flatMap((i) => {
      const problem = ((i.card as { problem?: string } | null)?.problem ?? "").trim();
      return problem ? [{ id: i.id as string, kind: "initiative" as const, title: i.title as string, body: problem }] : [];
    }),
  ];
}

/**
 * Kandydaci wyłącznie po PROBLEMIE: słowa użytkownika i słowa kluczowe karty porównujemy z problemem kandydata
 * — nie z nazwą, rozwiązaniem ani grupą odbiorców. Działa na całej tabeli, niezależnie od search_index i od tego,
 * jak model streścił opis, więc łapie też opisy problemu wklejone słowo w słowo.
 *
 * Każde słowo waży tyle, ile jest rzadkie wśród kandydatów (IDF). overlap = ważona część słów z opisu użytkownika
 * obecnych w problemie kandydata (0–1); problem wklejony słowo w słowo daje ~1. Słowa kluczowe z karty (formy
 * podstawowe z LLM) liczymy tak samo — to one łapią parafrazy.
 */
export async function lexicalCandidates(originalText: string, keywords: string[], kinds: SourceKind[]): Promise<Lexical[]> {
  // Ta sama pozycja dwa razy w bazie zajmowałaby dwa miejsca w reranku.
  const seen = new Set<string>();
  const docs = (await loadDocs(kinds))
    .filter((d) => {
      const key = `${d.title.trim().toLowerCase()}|${d.body.toLowerCase()}`;
      return !seen.has(key) && seen.add(key);
    })
    .map((d) => {
      const tokens = [...new Set(words(d.body))];
      return { ...d, has: (s: string) => tokens.some((t) => t.startsWith(s)) };
    });

  const userStems = contentStems(originalText);
  const keywordStems = [...new Set(keywords.flatMap(words).filter((w) => w.length >= 4).map(stem))];
  const idf = new Map(
    [...new Set([...userStems, ...keywordStems])].map((s) => {
      const df = docs.filter((d) => d.has(s)).length;
      return [s, Math.log((docs.length + 1) / (df + 1))];
    }),
  );
  const weighted = (stems: string[], has: (s: string) => boolean) => {
    const total = stems.reduce((sum, s) => sum + (idf.get(s) ?? 0), 0);
    return total > 0 ? stems.filter(has).reduce((sum, s) => sum + (idf.get(s) ?? 0), 0) / total : 0;
  };

  return docs
    .map((d) => {
      const overlap = weighted(userStems, d.has);
      const score = overlap * 10 + weighted(keywordStems, d.has) * 6;
      return { candidate: { id: d.id, title: d.title, body: d.body, overlap }, kind: d.kind, overlap, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Rerank z siatką bezpieczeństwa: kandydat, którego problem użytkownik powtórzył prawie słowo w słowo, zostaje
 * w wynikach z fit ≥ 85, nawet gdy model, sugerując się streszczeniem, ocenił go nisko.
 */
export async function rankCandidates(
  query: { summary: string; keywords: string[] },
  lexical: Lexical[],
  original: string,
  gminaProfile?: string,
): Promise<RerankItem[]> {
  const candidates: Candidate[] = [];
  const add = (c: Candidate) => {
    if (candidates.length < CANDIDATES && !candidates.some((x) => x.id === c.id)) candidates.push(c);
  };
  // Najpierw te, których problem mocno pokrywa się z opisem, potem reszta według dopasowania słów.
  lexical.filter((l) => l.overlap >= STRONG_OVERLAP).forEach((l) => add(l.candidate));
  lexical.forEach((l) => add(l.candidate));

  const ranked = await rerank(query, candidates, gminaProfile, original);
  const wordCount = contentStems(original).length;
  const repeats = (l: Lexical) => l.overlap >= VERBATIM_OVERLAP && wordCount >= VERBATIM_MIN_WORDS;
  for (const l of lexical.filter((x) => repeats(x) && candidates.some((c) => c.id === x.candidate.id))) {
    const r = ranked.find((x) => x.id === l.candidate.id);
    if (r && r.fit >= 80) continue;
    const pinned = {
      id: l.candidate.id,
      fit: 85,
      why: "Twój opis prawie dosłownie powtarza problem, na który odpowiada ta pozycja.",
      adapt: r?.adapt || "Porównaj opis z sytuacją u Ciebie i sprawdź, czego potrzeba do przeniesienia.",
    };
    if (r) Object.assign(r, pinned);
    else ranked.push(pinned);
  }
  return ranked.sort((a, b) => b.fit - a.fit);
}

/** Wyniki rerankingu → karty do pokazania (tytuł, link, gmina, liczba adopcji). matchIds: id wierszy w tabeli matches. */
export async function matchDetails(ranked: RerankItem[], kindOf: Map<string, SourceKind>, matchIds: Map<string, string>): Promise<Match[]> {
  const supabase = createAdminClient();
  const ids = (kind: SourceKind) => ranked.filter((r) => kindOf.get(r.id) === kind).map((r) => r.id);
  const [patterns, initiatives] = await Promise.all([
    ids("pattern").length
      ? supabase.from("patterns").select("id, title, slug, etr_summary, solution, adoptions_count, avg_rating").in("id", ids("pattern"))
      : { data: [], error: null },
    ids("initiative").length
      ? supabase.from("public_initiatives").select("id, title, slug, summary, municipality, adoptions_count, avg_rating").in("id", ids("initiative"))
      : { data: [], error: null },
  ]);
  if (patterns.error) throw patterns.error;
  if (initiatives.error) throw initiatives.error;
  const byId = new Map<string, Omit<Match, keyof RerankItem | "matchId">>([
    ...(patterns.data ?? []).map((p) => [p.id as string, {
      kind: "pattern" as const, title: p.title as string, slug: p.slug as string | null, gmina: null,
      summary: (p.etr_summary as string | null) ?? (p.solution as string | null),
      adoptionsCount: (p.adoptions_count as number) ?? 0, avgRating: p.avg_rating != null ? Number(p.avg_rating) : null,
    }] as const),
    ...(initiatives.data ?? []).map((i) => [i.id as string, {
      kind: "initiative" as const, title: i.title as string, slug: i.slug as string | null, gmina: i.municipality as string | null,
      summary: i.summary as string | null,
      adoptionsCount: (i.adoptions_count as number) ?? 0, avgRating: i.avg_rating != null ? Number(i.avg_rating) : null,
    }] as const),
  ]);
  return ranked.flatMap((r) => {
    const d = byId.get(r.id);
    return d ? [{ ...r, ...d, matchId: matchIds.get(r.id) ?? null }] : [];
  });
}

/** Mentorzy i otwarte programy pasujące do słów kluczowych (bez reranku — sam próg podobieństwa). */
export async function relatedSupport(keywords: string[]): Promise<{ mentors: MentorHit[]; programs: ProgramHit[] }> {
  const [mentorHits, programHits] = await Promise.all([keywordSearch("mentor", keywords, 5), keywordSearch("program", keywords, 5)]);
  const mentorIds = mentorHits.filter((h) => h.similarity >= RELATED_MIN_SIMILARITY).map((h) => h.ref_id);
  const programIds = programHits.filter((h) => h.similarity >= RELATED_MIN_SIMILARITY).map((h) => h.ref_id);
  const supabase = createAdminClient();
  const [mentors, programs] = await Promise.all([
    mentorIds.length ? supabase.from("mentors").select("id, name, bio").eq("active", true).in("id", mentorIds) : { data: [], error: null },
    programIds.length ? supabase.from("programs").select("id, title, closes_at").eq("active", true).in("id", programIds) : { data: [], error: null },
  ]);
  if (mentors.error) throw mentors.error;
  if (programs.error) throw programs.error;
  return {
    mentors: (mentors.data ?? []).map((m) => ({ id: m.id as string, name: m.name as string, bio: m.bio as string })),
    programs: (programs.data ?? []).map((p) => ({ id: p.id as string, title: p.title as string, closesAt: p.closes_at as string | null })),
  };
}
