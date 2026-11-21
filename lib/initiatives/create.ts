import "server-only";
import { after } from "next/server";
import { findGmina } from "../gminy";
import { relatedSupport } from "../matching";
import { notify } from "../notifications";
import { slugify } from "../pl";
import {
  SIMILAR_INITIATIVE_MIN_SIMILARITY,
  type IdeaPoster, type InitiativeCard, type InitiativeResponse, type SimilarInitiative, type SubmissionKind,
} from "../schemas";
import { similarInitiatives, upsertIndex } from "../search";
import { similarSources } from "../sources";
import { assessAndExplain, pathwaysFor, type PathwaysView } from "../pathways";
import { newStatusCode } from "../status-code";
import { createAdminClient } from "../supabase/admin";
import { newAccessKey } from "./access";

type CreateInput = {
  kind: SubmissionKind;
  /** Już znormalizowana (normalizeCard) przy wejściu do systemu: po LLM albo po żądaniu klienta. */
  card: InitiativeCard;
  text: string;
  gmina?: string;
  teryt?: string;
  /** Nazwa instytucji z formularza; dopasowana do tabeli institutions albo zapisana w raw_text dla zespołu. */
  institution?: string;
  /** Z warsztatu (/zglos/warsztat): canvas i plakat zapisujemy razem z inicjatywą. */
  canvas?: Record<string, string>;
  poster?: IdeaPoster;
  /** Zalogowany autor widzi inicjatywę na swoim koncie; bez konta wystarczy kod i prywatny link. */
  authorId?: string | null;
};

/**
 * Zgłoszenie albo wskazanie inicjatywy: zapis z kodem i tajnym kluczem, a w odpowiedzi to, co pomoże ją rozwinąć —
 * podobne inicjatywy z regionu (potencjalni partnerzy), ścieżki rozwoju z partnerami i otwarte programy. Inicjatywa jest prywatna, dopóki zespół nie opublikuje jej w Panelu.
 */
export async function createInitiative({ kind, card, text, gmina, teryt, institution, canvas, poster, authorId }: CreateInput): Promise<InitiativeResponse> {
  const supabase = createAdminClient();
  // Błąd wyszukiwania instytucji nie blokuje zgłoszenia — nazwa trafi wtedy do raw_text.
  const institutionRow = await findInstitution(institution).catch((e) => { console.error("[zgłoszenie] instytucja:", e); return null; });
  // Typ instytucji z bazy jest pewny; w karcie jest wybór z formularza albo rozpoznanie modelu z opisu.
  const institutionType = (institutionRow?.institution_type as InitiativeCard["institutionType"] | undefined) ?? card.institutionType;
  // Nazwa spoza bazy nie przepada: zespół zobaczy ją w Panelu przy treści zgłoszenia (raw_text jest prywatny).
  const rawText = institution && !institutionRow ? `${text}\n\nInstytucja (z formularza): ${institution}` : text;

  // Szukamy, zanim zapiszemy nową inicjatywę — dzięki temu nie znajdzie samej siebie.
  const [gminaRow, similar, support, sources] = await Promise.all([
    findGmina(gmina, teryt)
      .then((g) => g ?? (institutionRow?.teryt ? findGmina(null, institutionRow.teryt) : null))
      .then((g) => g ?? findGmina(card.municipality)),
    similarInitiatives(card.keywords, SIMILAR_INITIATIVE_MIN_SIMILARITY),
    relatedSupport(card.keywords),
    // Sprawdzanie dublowania (7/10): patenty, publikacje i projekty ze źródeł. Błąd nie blokuje zgłoszenia.
    similarSources(card.keywords).catch((e) => { console.error("[zgłoszenie] podobne w źródłach:", e); return []; }),
  ]);
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
        raw_text: rawText,
        card,
        title: card.title,
        summary: card.summary,
        domains: card.domains,
        institution_type: institutionType,
        institution_id: institutionRow?.id ?? null,
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

  // Ocena radaru i po niej uzasadnienie ścieżek (dwa wywołania modelu) nie blokują odpowiedzi: liczą się po jej wysłaniu.
  // Przy błędzie albo limicie Groq zgłoszenie zostaje bez oceny — Panel pokaże „Oceń ponownie” i „Przygotuj uzasadnienie”.
  const assess = () => assessAndExplain(initiative.id).then(() => undefined, (e) => console.error("[zgłoszenie] ocena radaru i ścieżki:", e));
  try {
    after(assess);
  } catch {
    void assess(); // poza żądaniem (skrypt, test) after() nie działa
  }

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
      tags: [card.stage, card.innovationKind, ...card.sectors, ...card.cross],
      institutionType,
      teryt: gminaRow?.teryt ?? null,
    }),
    notify({
      role: "admin",
      kind: "nowa_inicjatywa",
      payload: { initiativeId: initiative.id, statusCode: initiative.status_code, title: card.title, submissionKind: kind },
    }),
  ]);
  for (const r of sideEffects) if (r.status === "rejected") console.error("[zgłoszenie] efekt uboczny:", r.reason);

  // Wstępne ścieżki i partnerzy z samych reguł (bez oceny radaru, bez modelu) — od razu w wyniku zgłoszenia.
  const pathways = await pathwaysFor({
    innovation_kind: card.innovationKind, stage: card.stage, trl: card.trl, sectors: card.sectors, ip_status: card.ipStatus,
    institution_type: institutionType, domains: card.domains, teryt: gminaRow?.teryt ?? null, card, radar: null,
  }).catch((e): PathwaysView | null => { console.error("[zgłoszenie] ścieżki:", e); return null; });

  return {
    initiative: { id: initiative.id, statusCode: initiative.status_code, accessKey: access.key, gmina: gminaRow?.nazwa ?? null },
    similar: await similarDetails(similar),
    similarGminy: otherGminy(similar, gminaRow?.teryt ?? null),
    ...support,
    similarSources: sources,
    pathways,
  };
}

/**
 * Instytucja z bazy po nazwie wpisanej w formularzu: bez różnicy wielkości liter, tylko gdy pasuje dokładnie jedna.
 * Przy dwóch o tej samej nazwie nie zgadujemy — zespół połączy zgłoszenie w Panelu.
 */
async function findInstitution(name: string | undefined) {
  const q = name?.trim();
  if (!q || q.length < 3) return null;
  const { data, error } = await createAdminClient()
    .from("institutions")
    .select("id, institution_type, teryt")
    .ilike("name", q.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(2);
  if (error) throw error;
  return data?.length === 1 ? (data[0] as { id: string; institution_type: string; teryt: string | null }) : null;
}

/**
 * Twórcy z ról w karcie: bez imion i bez kontaktu, niewidoczni publicznie, dopóki sami (albo opiekun) się nie zgodzą.
 * Uczeń domyślnie liczy się jako osoba poniżej 18 lat — Panel zmienia to po potwierdzeniu.
 */
async function saveCreators(initiativeId: string, roles: InitiativeCard["creatorRoles"]) {
  if (roles.length === 0) return;
  // Jedna funkcja w bazie = jedna transakcja: albo twórcy i powiązania, albo nic (bez osieroconych wierszy).
  const { error } = await createAdminClient().rpc("add_initiative_creators", { p_initiative: initiativeId, p_roles: roles });
  if (error) throw error;
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

/** Ile innych gmin ma podobne inicjatywy — liczymy gminy, nie zgłoszenia, i bez własnej. */
function otherGminy(similar: Awaited<ReturnType<typeof similarInitiatives>>, own: string | null) {
  const gminy = new Map<string, string>();
  for (const s of similar) if (s.teryt && s.teryt !== own) gminy.set(s.teryt, s.municipality ?? s.teryt);
  return { count: gminy.size, gminy: [...gminy.values()] };
}
