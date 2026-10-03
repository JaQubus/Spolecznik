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

export const CARD_KINDS = ["innowacja", "potrzeba", "pomysl", "ekspert", "nabor"] as const;
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
  previousCard: NeedCard.optional(), // przy odpowiedzi na pytanie doprecyzowujące
});

export const MatchRequest = z.object({
  card: NeedCard,
  teryt: z.string().nullable().optional(),
});

/** Próg, poniżej którego potrzeba trafia na mapę luk. */
export const GAP_THRESHOLD = 50;
/** Próg, poniżej którego dopytujemy zamiast szukać. */
export const CLARITY_THRESHOLD = 0.6;
