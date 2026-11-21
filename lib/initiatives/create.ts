import "server-only";
import { describeGmina, findGmina } from "../gminy";
import { lexicalCandidates, matchDetails, rankCandidates, relatedSupport } from "../matching";
import { notify } from "../notifications";
import { anonymize } from "../pii";
import { slugify } from "../pl";
import {
  GAP_THRESHOLD, SIMILAR_INITIATIVE_MIN_SIMILARITY, normalizeCard,
  type IdeaPoster, type InitiativeCard, type InitiativeResponse, type SimilarInitiative, type SubmissionKind,
} from "../schemas";
import { similarInitiatives, upsertIndex } from "../search";
import { newStatusCode } from "../status-code";
import { createAdminClient } from "../supabase/admin";
import { newAccessKey } from "./access";

type CreateInput = {
  kind: SubmissionKind;
  card: InitiativeCard;
  text: string;
  gmina?: string;
  teryt?: string;
  /** Z warsztatu (/zglos/warsztat): canvas i plakat zapisujemy razem z inicjatywą. */
  canvas?: Record<string, string>;
  poster?: IdeaPoster;
  /** Zalogowany autor widzi inicjatywę na swoim koncie; bez konta wystarczy kod i prywatny link. */
  authorId?: string | null;
};

/**
 * Zgłoszenie albo wskazanie inicjatywy: zapis z kodem i tajnym kluczem, a w odpowiedzi to, co pomoże ją rozwinąć —
 * podobne inicjatywy z regionu (potencjalni partnerzy), sprawdzone rozwiązania z Polski (inspiracje), mentorzy
 * i otwarte programy. Inicjatywa jest prywatna, dopóki zespół nie opublikuje jej w Panelu.
 */
export async function createInitiative({ kind, card: input, text, gmina, teryt, canvas, poster, authorId }: CreateInput): Promise<InitiativeResponse> {
  const supabase = createAdminClient();
  // Karta przychodzi od klienta: TRL przy innowacji nietechnologicznej odrzuciłby check w bazie (0007).
  const card = normalizeCard(input);
  const original = anonymize(text).text;

  // Szukamy, zanim zapiszemy nową inicjatywę — dzięki temu nie znajdzie samej siebie.
  const [gminaRow, similar, lexical, support] = await Promise.all([
    findGmina(gmina, teryt).then((g) => g ?? findGmina(card.municipality)),
    similarInitiatives(card.keywords, SIMILAR_INITIATIVE_MIN_SIMILARITY),
    lexicalCandidates(original, card.keywords, ["pattern"]),
    relatedSupport(card.keywords),
  ]);
  const query = { summary: `${card.problem} ${card.summary}`, keywords: card.keywords };
  const ranked = await rankCandidates(query, lexical, original, gminaRow ? describeGmina(gminaRow) : undefined);

  // Zapis z kodem zgłoszenia (ponowienie przy kolizji kodu) i skrótem klucza do rozmowy.
  const access = newAccessKey();
  let row: { id: string; status_code: string } | null = null;
  for (let attempt = 0; attempt < 3 && !row; attempt++) {
    const code = newStatusCode();
    const { data, error } = await supabase
      .from("initiatives")
      .insert({
        status_code: code,
        slug: `${slugify(card.title, 50)}-${code.slice(-4).toLowerCase()}`,
        submission_kind: kind,
        author_id: authorId ?? null,
        access_hash: access.hash,
        raw_text: text,
        card,
        title: card.title,
        summary: card.summary,
        domains: card.domains,
        institution_type: card.institutionType,
        stage: card.stage,
        cross_topics: card.cross,
        innovation_kind: card.innovationKind,
        sectors: card.sectors,
        trl: card.trl,
        ip_status: card.ipStatus,
        teryt: gminaRow?.teryt ?? null,
        nominations_count: kind === "nomination" ? 1 : 0,
        ...(canvas ? { canvas } : {}),
        ...(poster ? { poster } : {}),
      })
      .select("id, status_code")
      .single();
    if (error && error.code !== "23505") throw error;
    row = data;
  }
  if (!row) throw new Error("Nie udało się nadać kodu zgłoszenia");
  const initiative = row;

  // Wszystkie oceny zapisujemy (analityka), pokazujemy tylko te powyżej progu.
  const kindOf = new Map(lexical.map((l) => [l.candidate.id, l.kind]));
  const { data: matchRows, error: matchError } = ranked.length
    ? await supabase
        .from("matches")
        .insert(ranked.map((m) => ({ initiative_id: initiative.id, target_kind: "pattern", target_id: m.id, fit: m.fit, why: m.why, adapt: m.adapt })))
        .select("id, target_id")
    : { data: [], error: null };
  if (matchError) throw matchError;
  const matchIds = new Map((matchRows ?? []).map((r) => [r.target_id as string, r.id as string]));

  // Indeks i powiadomienie nie mogą zablokować wyniku dla autora.
  const sideEffects = await Promise.allSettled([
    saveCreators(initiative.id, card.creatorRoles),
    upsertIndex({
      kind: "initiative",
      refId: initiative.id,
      title: card.title,
      body: `${card.problem} ${card.solution}`,
      lemmas: card.keywords,
      domains: [...card.domains],
      tags: [card.stage, ...card.cross],
      institutionType: card.institutionType,
      teryt: gminaRow?.teryt ?? null,
    }),
    notify({
      role: "admin",
      kind: "nowa_inicjatywa",
      payload: { initiativeId: initiative.id, statusCode: initiative.status_code, title: card.title, submissionKind: kind },
    }),
  ]);
  for (const r of sideEffects) if (r.status === "rejected") console.error("[zgłoszenie] efekt uboczny:", r.reason);

  return {
    initiative: { id: initiative.id, statusCode: initiative.status_code, accessKey: access.key, gmina: gminaRow?.nazwa ?? null },
    similar: await similarDetails(similar),
    similarGminy: otherGminy(similar, gminaRow?.teryt ?? null),
    patterns: await matchDetails(ranked.filter((m) => m.fit >= GAP_THRESHOLD), kindOf, matchIds),
    ...support,
  };
}

/**
 * Twórcy z ról w karcie: bez imion i bez kontaktu, niewidoczni publicznie, dopóki sami (albo opiekun) się nie zgodzą.
 * Uczeń domyślnie liczy się jako osoba poniżej 18 lat — Panel zmienia to po potwierdzeniu.
 */
async function saveCreators(initiativeId: string, roles: InitiativeCard["creatorRoles"]) {
  if (roles.length === 0) return;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creators")
    .insert(roles.map((role) => ({ role, under_18: role === "uczen" })))
    .select("id");
  if (error) throw error;
  const { error: linkError } = await supabase
    .from("initiative_creators")
    .insert((data ?? []).map((c, sort) => ({ initiative_id: initiativeId, creator_id: c.id, sort })));
  if (linkError) throw linkError;
}

/** Opublikowane z tytułem i linkiem; nieopublikowane tylko z gminą — treść cudzych zgłoszeń jest prywatna. */
async function similarDetails(similar: Awaited<ReturnType<typeof similarInitiatives>>): Promise<SimilarInitiative[]> {
  if (similar.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("public_initiatives")
    .select("id, title, slug")
    .in("id", similar.map((s) => s.initiative_id));
  if (error) throw error;
  const published = new Map((data ?? []).map((p) => [p.id as string, p]));
  return similar
    .map((s) => {
      const p = published.get(s.initiative_id);
      return { id: s.initiative_id, title: (p?.title as string) ?? null, slug: (p?.slug as string) ?? null, gmina: s.municipality, similarity: s.similarity };
    })
    .filter((s) => s.title)
    .slice(0, 5);
}

/** „W 4 innych gminach działa coś podobnego” — liczymy gminy, nie zgłoszenia, i bez własnej. */
function otherGminy(similar: Awaited<ReturnType<typeof similarInitiatives>>, own: string | null) {
  const gminy = new Map<string, string>();
  for (const s of similar) if (s.teryt && s.teryt !== own) gminy.set(s.teryt, s.municipality ?? s.teryt);
  return { count: gminy.size, gminy: [...gminy.values()] };
}
