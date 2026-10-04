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

/** Statusy testu (Próba). Tester zgłasza tylko „planowany” albo „zakonczony”, resztę ustawia ROPS w Panelu → Testy. */
export const TEST_STATUSES = ["planowany", "potwierdzony", "w_trakcie", "zakonczony"] as const;

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
  teryt: z.string().regex(/^\d{7}$/).optional(), // gmina wybrana z podpowiedzi — rozstrzyga np. Bochnię miejską i wiejską
});

export const FeedbackRequest = z.object({
  matchId: z.uuid(),
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]), // 0 = cofnięcie oceny
});

// /api/index-card: lematy i tagi obu osi dla karty w indeksie (README 5.3)
export const IndexCardRequest = z.object({
  kind: z.enum(CARD_KINDS),
  refId: z.uuid(),
});
export const CardTags = z.object({
  lemmas: z.array(z.string()).min(3).max(20), // FORMY PODSTAWOWE, jak keywords w NeedCard
  areas: z.array(z.enum(MWS_AREAS)).max(3),
  groups: z.array(z.enum(GROUPS)).max(3),
});
export type CardTags = z.infer<typeof CardTags>;

// /api/ask: Zapytaj Bibliotekę (RAG po doc_chunks)
export const AskRequest = z.object({ question: z.string().min(3).max(1000) });
export const AskAnswer = z.object({
  answered: z.boolean(), // false, gdy fragmenty raportów nie zawierają odpowiedzi
  answer: z.string(),
  sources: z.array(z.number().int()).max(5), // numery fragmentów z <fragment n="…">
});
export type AskResponse = {
  answered: boolean;
  answer: string;
  sources: { docTitle: string; year: number | null; url: string | null; page: number | null }[];
};

// Pracownia: fiszka pomysłu (ideas.fiszka). Klucze jak w data/out/synthetic.json.
export const Fiszka = z.object({
  krotki_opis: z.string().min(1).max(500),
  problem: z.string().max(3000).default(""),
  istota: z.string().max(3000).default(""),
  dla_kogo: z.string().max(1000).default(""),
  etap: z.string().max(200).default(""),
});
export type Fiszka = z.infer<typeof Fiszka>;

/** Kod zgłoszenia z lib/status-code.ts (bez 0, 1, I, O). */
export const STATUS_CODE = /^SPL-[2-9A-HJ-NP-Z]{4}$/;

// /api/ideas: zgłoszenie pomysłu z Pracowni
export const IdeaRequest = z.object({
  fiszka: Fiszka,
  canvas: z.record(z.string(), z.string().max(3000)).default({}),
  needCode: z.string().regex(STATUS_CODE).optional(), // pomysł z luki: /pomysl?potrzeba=SPL-…
});
/** accessKey: tajny klucz pomysłu — tylko dla autora (ciasteczko + prywatny link), jak w MatchResponse. */
export type IdeaResponse = { ideaId: string; statusCode: string; accessKey: string };

// /api/tests: Próba — zgłoszenie testu albo ocena po teście (#19)
export const TestRequest = z
  .object({
    innovationId: z.uuid(),
    gmina: z.string().min(2).max(100),
    teryt: z.string().regex(/^\d{7}$/).optional(), // gmina wybrana z podpowiedzi (GminaField)
    status: z.enum(TEST_STATUSES).extract(["planowany", "zakonczony"]),
    testerOrg: z.string().max(200).optional(),
    plannedFor: z.iso.date().optional(),
    contactEmail: z.email().max(254).optional(), // powiadomienia o statusie testu bez konta
    rating: z.number().int().min(1).max(5).optional(),
    feedback: z.string().max(2000).optional(), // co działa
    suggestions: z.string().max(2000).optional(), // co poprawić
  })
  .refine((t) => t.status !== "zakonczony" || t.rating != null, { path: ["rating"], message: "Wybierz ocenę od 1 do 5" });

// /api/rozmowy: wiadomość autora w wątku zgłoszenia (wchodzi po kodzie, bez konta)
export const ThreadPostRequest = z.object({
  code: z.string().regex(STATUS_CODE),
  body: z.string().trim().min(2, "Wpisz wiadomość").max(2000, "Wiadomość może mieć najwyżej 2000 znaków"),
  expertId: z.uuid().optional(), // „Zapytaj eksperta” z wyników dopasowania
});

// /api/assistant: asystent Pracowni
export const AssistantRequest = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30),
  fiszka: Fiszka.optional(),
});
export type AssistantResponse = {
  reply: string;
  similar: { kind: "innowacja" | "pomysl"; id: string; title: string; similarity: number; slug: string | null }[];
};

// /api/middleman: karta wdrożeniowa
export const MiddlemanRequest = z.object({
  innovationId: z.uuid(),
  gmina: z.string().min(1).max(100),
  teryt: z.string().regex(/^\d{7}$/).optional(), // gmina wybrana z podpowiedzi (GminaField)
});
export const ImplementationCard = z.object({
  goal: z.string(),
  audience: z.string(), // odbiorcy w tej gminie, z liczbami z profilu BDL
  serviceForm: z.string(), // np. w ramach Centrum Usług Społecznych
  steps: z.array(z.string()).min(3).max(10),
  staffAndResources: z.string(),
  costEstimate: z.object({ minPln: z.number(), maxPln: z.number(), basis: z.string() }), // zawsze szacunek
  partners: z.array(z.object({ id: z.string(), role: z.string() })).max(5),
  risks: z.array(z.string()).max(6),
  successIndicators: z.array(z.string()).max(6),
  assumptions: z.array(z.string()), // jawnie oznaczone założenia
});
export type ImplementationCard = z.infer<typeof ImplementationCard>;

// /api/apply: szkic wniosku do aktywnego naboru
export const ApplyRequest = z.object({ ideaId: z.uuid(), callId: z.uuid() });
export const ApplicationDraft = z.object({
  sections: z.array(z.object({ field: z.string(), label: z.string(), content: z.string() })).min(1),
  checklist: z.array(z.object({ criterion: z.string(), met: z.boolean(), note: z.string() })),
});
export type ApplicationDraft = z.infer<typeof ApplicationDraft>;

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
  /** accessKey: tajny klucz do rozmowy — tylko dla autora (ciasteczko + prywatny link). */
  need: { id: string; statusCode: string; accessKey: string; gmina: string | null };
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
 * Progi podobieństwa = jaka część słów kluczowych zapytania pasuje do karty (keyword_search, 0–1).
 * Eksperci i nabory nie przechodzą przez rerank, więc odcinamy je samym progiem. Do dostrojenia na eval.py.
 */
export const RELATED_MIN_SIMILARITY = 0.25;
export const SIMILAR_NEED_MIN_SIMILARITY = 0.5;
/** Od tego podobieństwa asystent Pracowni mówi „podobne już istnieje”. */
export const NOVELTY_MIN_SIMILARITY = 0.5;
