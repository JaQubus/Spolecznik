import { z } from "zod";

// Oś 1: obszary Mapy Wyzwań Społecznych
export const MWS_AREAS = [
  "rodzina_piecza", "bezdomnosc", "niepelnosprawnosc", "ubostwo",
  "cudzoziemcy", "zdrowie", "zdrowie_psychiczne", "seniorzy",
] as const;

// Oś 2: kategorie Biblioteki Innowacji (grupy docelowe)
export const GROUPS = [
  "seniorzy", "dzieci_mlodziez_rodzina", "ograniczona_mobilnosc",
  "niepelnosprawnosc_sensoryczna", "zdrowie_medycyna", "rynek_pracy",
  "cudzoziemcy", "bezdomnosc", "niepelnosprawnosc_intelektualna",
] as const;

// Tematy przekrojowe z briefu
export const CROSS = [
  "samotnosc", "wykluczenie_cyfrowe", "dostep_do_uslug",
  "depopulacja_suburbanizacja", "wspolpraca_miedzysektorowa",
] as const;

// biblioteka / obszar / material — karty Zasobnika wiedzy (migracja 0005), osobno od korpusu matchmakingu.
export const CARD_KINDS = ["innowacja", "potrzeba", "pomysl", "ekspert", "nabor", "biblioteka", "obszar", "material"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export const NEED_STATUSES = [
  "zgloszone", "w_analizie", "ekspert", "odpowiedz", "luka", "zamkniete",
] as const;

export const NeedCard = z.object({
  summary: z.string(), // 1–2 zdania, bez danych osobowych
  areas: z.array(z.enum(MWS_AREAS)).min(1).max(3),
  groups: z.array(z.enum(GROUPS)).max(3),
  cross: z.array(z.enum(CROSS)).max(3),
  gmina: z.string().nullable(), // nazwa → TERYT po stronie serwera
  keywords: z.array(z.string()).min(3).max(12), // FORMY PODSTAWOWE: "senior", "samotność"
  alreadyTried: z.string().nullable(),
  clarity: z.number().min(0).max(1),
  followUp: z.string().nullable(), // pytanie doprecyzowujące albo null
});
export type NeedCard = z.infer<typeof NeedCard>;

export const RerankItem = z.object({
  id: z.string(),
  fit: z.number().min(0).max(100),
  why: z.string(), // jedno zdanie, do 25 słów
  adapt: z.string(), // co dostosować w tej gminie
});
export const RerankResult = z.object({ items: z.array(RerankItem).max(5) });
export type RerankItem = z.infer<typeof RerankItem>;

// Wejścia endpointów
export const IntakeRequest = z.object({
  text: z.string().min(3).max(5000),
  gmina: z.string().optional(),
  area: z.enum(MWS_AREAS).optional(), // obszar wybrany wcześniej, np. z „Biblioteki i wiedzy”
  previousCard: NeedCard.optional(), // przy odpowiedzi na pytanie doprecyzowujące
});

export const MatchRequest = z.object({
  card: NeedCard,
  text: z.string().min(3).max(10000), // oryginalny opis (+ odpowiedź na dopytanie) — tylko do needs.raw_text
  gmina: z.string().max(100).optional(), // to, co użytkownik wpisał w pole „Gmina”
});

export const FeedbackRequest = z.object({
  matchId: z.uuid(),
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]), // 0 = cofnięcie oceny
});

// Odpowiedź /api/match — wspólny typ dla serwera i klienta.
export type InnovationMatch = RerankItem & {
  matchId: string;
  title: string;
  slug: string | null;
  category: string | null;
  etrSummary: string | null;
  testsCount: number;
  avgRating: number | null;
};

export type MatchResponse = {
  need: { id: string; statusCode: string; gmina: string | null };
  matches: InnovationMatch[];
  isGap: boolean;
  similarNeeds: { count: number; gminy: string[] };
  experts: { id: string; name: string; description: string }[];
  calls: { id: string; title: string; closesAt: string | null }[];
};

/** Próg, poniżej którego potrzeba trafia na mapę luk. */
export const GAP_THRESHOLD = 50;
/** Próg, poniżej którego dopytujemy zamiast szukać. */
export const CLARITY_THRESHOLD = 0.6;
/**
 * Progi podobieństwa cosinusowego (text-embedding-3-small). Do dostrojenia na eval.py:
 * eksperci i nabory nie przechodzą przez rerank, więc odcinamy je samym podobieństwem.
 */
export const RELATED_MIN_SIMILARITY = 0.35;
export const SIMILAR_NEED_MIN_SIMILARITY = 0.55;
