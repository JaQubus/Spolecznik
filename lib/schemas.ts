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

// /panel/trendy: etykiety grup podobnych potrzeb, liczone wsadowo i trzymane w need_cluster_labels
export const ClusterLabels = z.object({
  clusters: z.array(z.object({
    n: z.number().int(),           // numer grupy z <grupa n="…">
    label: z.string().max(80),     // krótkie hasło, np. „Samotność seniorów na wsi”
    description: z.string().max(300), // jedno zdanie
  })),
});
export type ClusterLabels = z.infer<typeof ClusterLabels>;

// /api/ask: Zapytaj Bibliotekę (RAG po doc_chunks)
export const AskRequest = z.object({ question: z.string().min(3).max(1000) });
export const AskAnswer = z.object({
  answered: z.boolean(), // false, gdy fragmenty raportów nie zawierają odpowiedzi
  answer: z.string(),
  sources: z.array(z.number().int()).max(5), // numery fragmentów z <fragment n="…">
});
// Rozmowa: asystent jako pierwsza linia „Zapytaj ROPS” (lib/first-line.ts)
export const FirstLineAnswer = z.object({
  // odpowiedz: źródła zawierają odpowiedź · przekaz: nie zawierają albo pytanie o własną sprawę · bez_pytania: to nie pytanie
  decision: z.enum(["odpowiedz", "przekaz", "bez_pytania"]),
  answer: z.string().max(2000),
  sources: z.array(z.number().int()).max(5), // numery źródeł z <zrodlo n="…">
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
  poster: z.lazy(() => IdeaPoster).optional(), // plakat z /api/poster, jeśli autor go wygenerował
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

export const ThreadNotHelpfulRequest = z.object({ code: z.string().trim().toUpperCase().regex(STATUS_CODE) });

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

// /api/middleman: szkic planu wdrożenia pod nabór ROPS „Usługa Wrażliwa” (FEM 2021–2027, Działanie 6.23).
// Sekcje odpowiadają częściom III–VI „Wniosku o grant” (zał. 2 do ogłoszenia naboru IS-430-3/25).

/** Limity z ogłoszenia naboru: grant do 600 tys. zł, wdrożenie do 18 miesięcy, w tym przygotowanie do 6. */
export const GRANT = { maxPln: 600_000, maxMonths: 18, maxPreparationMonths: 6 } as const;

export const INSTITUTION_TYPES = ["jst", "ops", "pcpr", "cus", "ngo", "pes"] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];
export const INSTITUTION_LABELS: Record<InstitutionType, string> = {
  jst: "Urząd gminy lub starostwo",
  ops: "Ośrodek pomocy społecznej (OPS, GOPS, MOPS)",
  pcpr: "Powiatowe centrum pomocy rodzinie (PCPR)",
  cus: "Centrum usług społecznych (CUS)",
  ngo: "Organizacja pozarządowa",
  pes: "Podmiot ekonomii społecznej",
};

export const BUDGET_RANGES = ["do_100", "100_300", "300_600", "nie_wiem"] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number];
export const BUDGET_LABELS: Record<BudgetRange, string> = {
  do_100: "do 100 tys. zł",
  "100_300": "100–300 tys. zł",
  "300_600": "300–600 tys. zł",
  nie_wiem: "Jeszcze nie wiem",
};
/** Górna granica widełek w złotych; „nie wiem” to limit grantu. */
export const BUDGET_MAX_PLN: Record<BudgetRange, number> = {
  do_100: 100_000, "100_300": 300_000, "300_600": GRANT.maxPln, nie_wiem: GRANT.maxPln,
};

export const MiddlemanRequest = z.object({
  innovationId: z.uuid(),
  gmina: z.string().min(1).max(100),
  teryt: z.string().regex(/^\d{7}$/).optional(), // gmina wybrana z podpowiedzi (GminaField)
  institutionType: z.enum(INSTITUTION_TYPES),
  audienceSize: z.number().int().min(1).max(1_000_000).optional(), // przybliżona liczba odbiorców
  staff: z.string().trim().max(300).optional(), // dostępna kadra
  budget: z.enum(BUDGET_RANGES),
});
export type MiddlemanRequest = z.infer<typeof MiddlemanRequest>;

/** Liczba z profilu gminy z podanym źródłem (lib/gminy.ts → gminaFacts). Model wskazuje ją po id, nie przepisuje. */
export type GminaFact = { id: string; label: string; value: number; unit: string; source: string };

export const PLAN_STAGES = ["przygotowanie", "wdrozenie"] as const;

/** Odpowiedź modelu. Liczby o gminie tylko przez factId; liczby od modelu (osoby, koszty) są szacunkiem. */
export const ImplementationPlan = z.object({
  goal: z.string(), // cel usługi
  description: z.string(), // III.2: na czym polega usługa i jak wykorzystuje innowację
  serviceForm: z.string(), // np. w ramach Centrum Usług Społecznych
  audience: z.object({
    summary: z.string(), // kto skorzysta w tej gminie, bez liczb
    facts: z.array(z.object({ factId: z.string(), why: z.string() })).max(6),
  }),
  peopleSupported: z.object({ women: z.number().int().min(0), men: z.number().int().min(0), basis: z.string() }), // III.7
  recruitment: z.string(), // III.6
  steps: z.array(z.object({
    stage: z.enum(PLAN_STAGES),
    title: z.string(),
    details: z.string(),
    monthFrom: z.number().int(),
    monthTo: z.number().int(),
    costPln: z.number().min(0),
    costBasis: z.string(), // sposób kalkulacji, np. „12 h × 100 zł”
  })).min(3).max(10),
  staffAndResources: z.string(),
  costEstimate: z.object({ minPln: z.number(), maxPln: z.number(), basis: z.string() }), // zawsze szacunek
  partners: z.array(z.object({ id: z.string(), role: z.string() })).max(5),
  partnerTypes: z.array(z.string()).max(5), // gdy w bazie nie ma partnerów: typy, bez nazw
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })).max(6),
  successIndicators: z.array(z.string()).max(6),
  horizontalPrinciples: z.string(), // IV: równość szans, dostępność, DNSH
  sustainability: z.string(), // V: utrzymanie efektów po grancie
  deinstitutionalization: z.string(), // VI
  assumptions: z.array(z.string()), // jawnie oznaczone założenia
});
export type ImplementationPlan = z.infer<typeof ImplementationPlan>;

/** Plan po sprawdzeniu na serwerze (lib/implementation-plan.ts): fakty z wartościami, partnerzy z nazwami, suma i uwagi. */
export type CheckedPlan = Omit<ImplementationPlan, "audience" | "partners"> & {
  audience: { summary: string; facts: (GminaFact & { why: string })[] };
  partners: { id: string; name: string; role: string }[];
  totalPln: number; // suma kosztów działań
  warnings: string[]; // niezgodności z limitami naboru, wykryte przez serwer
};

/** Dokument zwracany przez /api/middleman i zapisywany w implementation_plans. */
export type PlanDocument = {
  id: string | null; // null, gdy zapis się nie udał
  createdAt: string;
  innovation: { id: string; title: string };
  gmina: { teryt: string; nazwa: string; label: string };
  input: Omit<MiddlemanRequest, "innovationId" | "gmina" | "teryt">;
  plan: CheckedPlan;
};

// /api/apply: szkic wniosku do aktywnego naboru
export const ApplyRequest = z.object({ ideaId: z.uuid(), callId: z.uuid() });
export const ApplicationDraft = z.object({
  sections: z.array(z.object({ field: z.string(), label: z.string(), content: z.string() })).min(1),
  checklist: z.array(z.object({ criterion: z.string(), met: z.boolean(), note: z.string() })),
});
export type ApplicationDraft = z.infer<typeof ApplicationDraft>;

// /api/poster: plakat pomysłu — wizualizacja z tekstu, bo Groq nie generuje obrazów.
/** Zamknięta lista ikon kroków; components/pomysl/idea-poster.tsx zamienia nazwy na Heroicons. */
export const POSTER_ICONS = [
  "user", "user-group", "home", "map-pin", "phone", "chat-bubble-left-right", "calendar-days", "truck",
  "heart", "academic-cap", "wrench-screwdriver", "light-bulb", "hand-raised", "building-office",
  "computer-desktop", "shopping-bag", "book-open", "megaphone", "puzzle-piece", "clipboard-document-check",
] as const;
export const POSTER_NEEDS = ["ludzie", "miejsce", "sprzet", "pieniadze", "partnerzy", "inne"] as const;
export const POSTER_SHAPES = ["prostokat", "pionowy", "plaski", "okragly"] as const;

/** Tekst plakatu: za długi przycinamy na granicy słowa z „…”, zamiast odrzucać całą odpowiedź modelu. */
const posterText = (max: number) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const text = v.trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    return `${cut.slice(0, cut.lastIndexOf(" ") > max / 2 ? cut.lastIndexOf(" ") : cut.length).replace(/[\s,;:–—-]+$/, "")}…`;
  }, z.string().min(1).max(max));

// Limity długości trzymają plakat krótkim: zwykle jedna strona A4; z każdym polem pełnym przy interlinii 1.5 (WCAG) może wejść na drugą.
export const IdeaPoster = z.object({
  headline: posterText(70),
  oneLiner: posterText(160),
  journey: z
    .array(z.object({
      who: posterText(40),
      action: posterText(110),
      // Nieznana nazwa ikony nie psuje plakatu — ikona jest tylko obok tekstu.
      icon: z.enum(POSTER_ICONS).catch("light-bulb"),
    }))
    .min(3)
    .max(4),
  benefits: z.array(posterText(90)).min(1).max(3),
  needs: z.array(z.object({ kind: z.enum(POSTER_NEEDS).catch("inne"), text: posterText(90) })).max(5),
  object: z
    .object({
      name: posterText(50),
      shape: z.enum(POSTER_SHAPES).catch("prostokat"),
      description: posterText(160),
      parts: z.array(z.object({ name: posterText(35), purpose: z.string().max(80).catch("") })).min(1).max(6),
    })
    .nullable(),
});
export type IdeaPoster = z.infer<typeof IdeaPoster>;
export const PosterRequest = z.object({
  fiszka: Fiszka,
  canvas: z.record(z.string(), z.string().max(3000)).default({}),
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
