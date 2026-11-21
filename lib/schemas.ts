import { z } from "zod";
import { STATUS_CODE } from "./brand.ts";
import {
  CREATOR_ROLE_KEYS, CROSS_KEYS, DOMAIN_KEYS, INNOVATION_KIND_KEYS, INSTITUTION_KEYS, IP_STATUS_KEYS, SECTOR_KEYS, STAGE_KEYS,
  TRL_MAX, TRL_MIN,
} from "./taxonomy.ts";

/** Rodzaje kart we wspólnym indeksie wyszukiwania (search_index.kind, 0001_core.sql). */
export const CARD_KINDS = ["initiative", "pattern", "challenge", "mentor", "program", "domain", "material", "partner", "source_record"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

/**
 * Statusy inicjatywy (initiatives.status). Publiczna jest dopiero po weryfikacji w Panelu (initiatives.published).
 * detected: kandydat wykryty w źródłach (0008), czeka na przejęcie przez twórcę albo weryfikację zespołu.
 */
export const INITIATIVE_STATUSES = ["detected", "submitted", "in_review", "featured", "supported", "scaling", "archived"] as const;
export type InitiativeStatus = (typeof INITIATIVE_STATUSES)[number];

/** own: autor zgłasza swoją inicjatywę · nomination: ktoś wskazuje cudzą · detected: Radar znalazł ją w źródłach. */
export const SUBMISSION_KINDS = ["own", "nomination", "detected"] as const;
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number];

/** Statusy adopcji („Wypróbowaliśmy u nas”). Zgłaszający podaje „planowany” albo „zakonczony”, resztę ustawia Panel. */
export const ADOPTION_STATUSES = ["planowany", "potwierdzony", "w_trakcie", "zakonczony"] as const;

const keywords = z.array(z.string()).min(3).max(12); // FORMY PODSTAWOWE: "uczeń", "robotyka", "transport publiczny"

/** Karta inicjatywy z intake (initiatives.card). Bez danych osobowych; nazwa instytucji zostaje tylko w raw_text. */
export const InitiativeCard = z.object({
  title: z.string().min(3).max(120),
  summary: z.string(), // 1–2 zdania prostym językiem
  problem: z.string(),
  solution: z.string(),
  effects: z.string().nullable(), // co już dało; null, gdy jeszcze nic nie wiadomo
  beneficiaries: z.string().nullable(),
  domains: z.array(z.enum(DOMAIN_KEYS)).min(1).max(3),
  institutionType: z.enum(INSTITUTION_KEYS).nullable(),
  stage: z.enum(STAGE_KEYS),
  cross: z.array(z.enum(CROSS_KEYS)).max(3),
  // Model innowacji pod PCI (config/taxonomy.json, 0007_innovation_model.sql)
  innovationKind: z.enum(INNOVATION_KIND_KEYS),
  sectors: z.array(z.enum(SECTOR_KEYS)), // sektory PCI (max 2, „inne”, gdy żaden nie pasuje) — porządkuje normalizeCard
  trl: z.number().int().min(TRL_MIN).max(TRL_MAX).nullable(), // tylko technologiczna; null, gdy opis nie pozwala ocenić
  ipStatus: z.enum(IP_STATUS_KEYS).nullable(), // null, gdy opis nic nie mówi o ochronie
  creatorRoles: z.array(z.enum(CREATOR_ROLE_KEYS)), // kto to tworzy (role, bez imion; max 3 — normalizeCard)
  municipality: z.string().nullable(), // nazwa → TERYT po stronie serwera
  keywords,
  clarity: z.number().min(0).max(1),
  followUps: z.array(z.string()).max(2), // pytania doprecyzowujące, gdy opisu nie wystarcza do oceny
});
export type InitiativeCard = z.infer<typeof InitiativeCard>;

export const MAX_SECTORS = 2;
export const MAX_CREATOR_ROLES = 3;

/**
 * Spójność karty, której nie wyrazi sam schemat (a odpowiedź LLM nie powinna przez nią odpadać): limity sektorów i ról
 * obcinamy zamiast odrzucać, TRL zostaje tylko przy innowacji technologicznej (jak check w 0007), a „inne” tylko wtedy,
 * gdy nie pasuje żaden sektor PCI. Wołamy raz, tam gdzie karta wchodzi do systemu: po LLM (intakeInitiative)
 * i po żądaniu klienta (/api/initiatives).
 */
export function normalizeCard(card: InitiativeCard): InitiativeCard {
  const pci = card.sectors.filter((s) => s !== "inne");
  return {
    ...card,
    sectors: pci.length ? [...new Set(pci)].slice(0, MAX_SECTORS) : ["inne"],
    creatorRoles: [...new Set(card.creatorRoles)].slice(0, MAX_CREATOR_ROLES),
    trl: card.innovationKind === "technologiczna" ? card.trl : null,
  };
}

/** „Szukam rozwiązania”: instytucja opisuje problem (challenges.card). */
export const ChallengeCard = z.object({
  summary: z.string(),
  domains: z.array(z.enum(DOMAIN_KEYS)).min(1).max(3),
  institutionType: z.enum(INSTITUTION_KEYS).nullable(),
  municipality: z.string().nullable(),
  keywords,
  clarity: z.number().min(0).max(1),
  followUp: z.string().nullable(),
});
export type ChallengeCard = z.infer<typeof ChallengeCard>;

export const RerankItem = z.object({
  id: z.string(),
  fit: z.number().min(0).max(100),
  why: z.string(), // jedno zdanie, do 25 słów
  adapt: z.string(), // co dostosować w tej gminie
});
export const RerankResult = z.object({ items: z.array(RerankItem).max(5) });
export type RerankItem = z.infer<typeof RerankItem>;

const teryt = z.string().regex(/^\d{7}$/); // gmina wybrana z podpowiedzi — rozstrzyga gminę miejską i wiejską o tej samej nazwie

// ── Wejścia endpointów ──
export const INTAKE_MODES = ["own", "nomination", "challenge"] as const;
export type IntakeMode = (typeof INTAKE_MODES)[number];

/** /api/intake: tekst → karta. previousCard przy odpowiedzi na pytanie doprecyzowujące (kształt zależy od trybu). */
export const IntakeRequest = z.discriminatedUnion("mode", [
  z.object({ mode: z.enum(["own", "nomination"]), text: z.string().min(3).max(5000), gmina: z.string().optional(), previousCard: InitiativeCard.optional() }),
  z.object({ mode: z.literal("challenge"), text: z.string().min(3).max(5000), gmina: z.string().optional(), previousCard: ChallengeCard.optional() }),
]);

/** /api/initiatives: zapis zgłoszenia albo wskazania po intake. */
export const InitiativeRequest = z.object({
  kind: z.enum(SUBMISSION_KINDS).extract(["own", "nomination"]), // detected tworzy tylko klasyfikator (lib/sources.ts)
  card: InitiativeCard,
  text: z.string().min(3).max(10000), // oryginalny opis (+ odpowiedzi na dopytanie) — tylko do initiatives.raw_text
  gmina: z.string().max(100).optional(), // to, co użytkownik wpisał w pole „Gmina”
  teryt: teryt.optional(),
});

/** /api/challenges: „Szukam rozwiązania” po intake. */
export const ChallengeRequest = z.object({
  card: ChallengeCard,
  text: z.string().min(3).max(10000),
  gmina: z.string().max(100).optional(),
  teryt: teryt.optional(),
});

export const FeedbackRequest = z.object({
  matchId: z.uuid(),
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]), // 0 = cofnięcie oceny
});

// /api/index-card: lematy i dziedziny karty w indeksie
export const IndexCardRequest = z.object({ kind: z.enum(CARD_KINDS), refId: z.uuid() });
export const CardTags = z.object({
  lemmas: z.array(z.string()).min(3).max(20), // FORMY PODSTAWOWE, jak keywords w kartach
  domains: z.array(z.enum(DOMAIN_KEYS)).max(3),
});
export type CardTags = z.infer<typeof CardTags>;

// /panel/trendy: etykiety grup podobnych inicjatyw i wyzwań, liczone wsadowo i trzymane w cluster_labels
export const ClusterLabels = z.object({
  clusters: z.array(z.object({
    n: z.number().int(),              // numer grupy z <grupa n="…">
    label: z.string().max(80),        // krótkie hasło, np. „Robotyka w małych szkołach”
    description: z.string().max(300), // jedno zdanie
  })),
});
export type ClusterLabels = z.infer<typeof ClusterLabels>;

// Rozmowa: asystent jako pierwsza linia (lib/first-line.ts)
export const FirstLineAnswer = z.object({
  // odpowiedz: źródła zawierają odpowiedź · przekaz: nie zawierają albo pytanie o własną sprawę · bez_pytania: to nie pytanie
  decision: z.enum(["odpowiedz", "przekaz", "bez_pytania"]),
  answer: z.string().max(2000),
  sources: z.array(z.number().int()).max(5), // numery źródeł z <zrodlo n="…">
});

/** Warsztat (/zglos/warsztat): szkic pomysłu przed zgłoszeniem. */
export const Sketch = z.object({
  summary: z.string().min(1).max(500),
  problem: z.string().max(3000).default(""),
  solution: z.string().max(3000).default(""),
  beneficiaries: z.string().max(1000).default(""),
  stage: z.string().max(200).default(""),
});
export type Sketch = z.infer<typeof Sketch>;

/** Kod zgłoszenia z lib/status-code.ts (bez 0, 1, I, O); prefiks z config/brand.json. */
export { STATUS_CODE };

/** /api/initiatives/workshop: zgłoszenie z warsztatu — kartę robi serwer z intake na szkicu. */
export const WorkshopRequest = z.object({
  sketch: Sketch,
  canvas: z.record(z.string(), z.string().max(3000)).default({}),
  poster: z.lazy(() => IdeaPoster).optional(), // plakat z /api/poster, jeśli autor go wygenerował
});

/** accessKey: tajny klucz do rozmowy — tylko dla autora (ciasteczko + prywatny link). */
export type SubmitResponseBase = { initiative: { id: string; statusCode: string; accessKey: string; gmina: string | null } };

// /api/adoptions: „Wypróbowaliśmy u nas” — zgłoszenie przeniesienia albo ocena po nim
export const AdoptionRequest = z
  .object({
    initiativeId: z.uuid().optional(),
    patternId: z.uuid().optional(),
    gmina: z.string().min(2).max(100),
    teryt: teryt.optional(),
    status: z.enum(ADOPTION_STATUSES).extract(["planowany", "zakonczony"]),
    adopterOrg: z.string().max(200).optional(),
    plannedFor: z.iso.date().optional(),
    contactEmail: z.email().max(254).optional(), // powiadomienia o statusie bez konta
    rating: z.number().int().min(1).max(5).optional(),
    worked: z.string().max(2000).optional(), // co działa
    improve: z.string().max(2000).optional(), // co poprawić
  })
  .refine((t) => (t.initiativeId == null) !== (t.patternId == null), { path: ["initiativeId"], message: "Wybierz inicjatywę albo rozwiązanie" })
  .refine((t) => t.status !== "zakonczony" || t.rating != null, { path: ["rating"], message: "Wybierz ocenę od 1 do 5" });

// /api/threads: wiadomość autora w wątku inicjatywy (wchodzi po kodzie, bez konta)
export const ThreadPostRequest = z.object({
  code: z.string().regex(STATUS_CODE),
  body: z.string().trim().min(2, "Wpisz wiadomość").max(2000, "Wiadomość może mieć najwyżej 2000 znaków"),
  mentorId: z.uuid().optional(), // „Zapytaj mentora” z wyników
});

export const ThreadNotHelpfulRequest = z.object({ code: z.string().trim().toUpperCase().regex(STATUS_CODE) });

// /api/assistant: asystent warsztatu
export const AssistantRequest = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30),
  sketch: Sketch.optional(),
});
export type AssistantResponse = {
  reply: string;
  similar: { kind: "initiative" | "pattern"; id: string; title: string; similarity: number; slug: string | null }[];
};

// ── /api/transfer: plan przeniesienia inicjatywy albo rozwiązania do wskazanej gminy i instytucji ──

/** Ramy planu: pilotaż przeniesienia do 12 miesięcy, w tym przygotowanie do 3. */
export const TRANSFER = { maxMonths: 12, maxPreparationMonths: 3 } as const;

export const BUDGET_RANGES = ["do_20", "20_50", "50_150", "nie_wiem"] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number];
export const BUDGET_LABELS: Record<BudgetRange, string> = {
  do_20: "do 20 tys. zł",
  "20_50": "20–50 tys. zł",
  "50_150": "50–150 tys. zł",
  nie_wiem: "Jeszcze nie wiem",
};
/** Górna granica widełek w złotych; „nie wiem” = bez ostrzeżenia o budżecie. */
export const BUDGET_MAX_PLN: Record<BudgetRange, number | null> = { do_20: 20_000, "20_50": 50_000, "50_150": 150_000, nie_wiem: null };

export const SOURCE_KINDS = ["initiative", "pattern"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const TransferRequest = z.object({
  sourceKind: z.enum(SOURCE_KINDS),
  sourceId: z.uuid(),
  gmina: z.string().min(1).max(100),
  teryt: teryt.optional(),
  institutionType: z.enum(INSTITUTION_KEYS),
  audienceSize: z.number().int().min(1).max(1_000_000).optional(), // przybliżona liczba odbiorców
  staff: z.string().trim().max(300).optional(), // dostępne osoby
  budget: z.enum(BUDGET_RANGES),
});
export type TransferRequest = z.infer<typeof TransferRequest>;

/** Liczba z profilu gminy z podanym źródłem (lib/gminy.ts → gminaFacts). Model wskazuje ją po id, nie przepisuje. */
export type GminaFact = { id: string; label: string; value: number; unit: string; source: string };

export const PLAN_STAGES = ["przygotowanie", "uruchomienie"] as const;

/** Odpowiedź modelu. Liczby o gminie tylko przez factId; liczby od modelu (osoby, koszty) są szacunkiem. */
export const TransferPlan = z.object({
  goal: z.string(),
  description: z.string(), // jak inicjatywa zadziała u nas
  adaptation: z.string(), // co zmieniamy względem oryginału i dlaczego
  audience: z.object({
    summary: z.string(), // kto skorzysta, bez liczb
    facts: z.array(z.object({ factId: z.string(), why: z.string() })).max(6),
  }),
  peopleReached: z.object({ count: z.number().int().min(0), basis: z.string() }),
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
  sustainability: z.string(), // co zostanie po pilotażu i kto za to zapłaci
  assumptions: z.array(z.string()), // jawnie oznaczone założenia
});
export type TransferPlan = z.infer<typeof TransferPlan>;

/** Plan po sprawdzeniu na serwerze (lib/transfer-plan.ts): fakty z wartościami, partnerzy z nazwami, suma i uwagi. */
export type CheckedPlan = Omit<TransferPlan, "audience" | "partners"> & {
  audience: { summary: string; facts: (GminaFact & { why: string })[] };
  partners: { id: string; name: string; role: string }[];
  totalPln: number; // suma kosztów działań
  warnings: string[]; // niezgodności z ramami planu, wykryte przez serwer
};

/** Dokument zwracany przez /api/transfer i zapisywany w transfer_plans. */
export type PlanDocument = {
  id: string | null; // null, gdy zapis się nie udał
  createdAt: string;
  source: { kind: SourceKind; id: string; title: string; href: string };
  gmina: { teryt: string; nazwa: string; label: string };
  input: Omit<TransferRequest, "sourceKind" | "sourceId" | "gmina" | "teryt">;
  plan: CheckedPlan;
};

// /api/apply: szkic wniosku do otwartego programu
export const ApplyRequest = z.object({ initiativeId: z.uuid(), programId: z.uuid() });
export const ApplicationDraft = z.object({
  sections: z.array(z.object({ field: z.string(), label: z.string(), content: z.string() })).min(1),
  checklist: z.array(z.object({ criterion: z.string(), met: z.boolean(), note: z.string() })),
});
export type ApplicationDraft = z.infer<typeof ApplicationDraft>;

// /api/poster: plakat pomysłu — wizualizacja z tekstu, bo Groq nie generuje obrazów.
/** Zamknięta lista ikon kroków; components/workshop/idea-poster.tsx zamienia nazwy na Heroicons. */
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
  sketch: Sketch,
  canvas: z.record(z.string(), z.string().max(3000)).default({}),
});

// ── Odpowiedzi wyników — wspólne typy dla serwera i klienta ──

/** Dopasowanie z uzasadnieniem: inicjatywa z regionu albo sprawdzone rozwiązanie z Polski. */
export type Match = RerankItem & {
  matchId: string | null;
  kind: SourceKind;
  title: string;
  slug: string | null;
  gmina: string | null; // tylko inicjatywy
  summary: string | null;
  adoptionsCount: number;
  avgRating: number | null;
};

export type MentorHit = { id: string; name: string; bio: string };
export type ProgramHit = { id: string; title: string; closesAt: string | null };

/** Podobna inicjatywa z regionu: opublikowana ma tytuł i link, nieopublikowana tylko gminę (zgłoszenia są prywatne). */
export type SimilarInitiative = { id: string; title: string | null; slug: string | null; gmina: string | null; similarity: number };

export type InitiativeResponse = SubmitResponseBase & {
  similar: SimilarInitiative[];
  /** Ile innych gmin ma podobne inicjatywy (także nieopublikowane) — liczymy gminy, nie zgłoszenia. */
  similarGminy: { count: number; gminy: string[] };
  patterns: Match[];
  mentors: MentorHit[];
  programs: ProgramHit[];
  /** „Podobne rozwiązanie już istnieje”: patenty, publikacje i projekty ze źródeł (sprawdzanie dublowania, 7/10). */
  similarSources: SimilarSource[];
};

export type ChallengeResponse = {
  challengeId: string;
  matches: Match[];
  isGap: boolean;
  mentors: MentorHit[];
  programs: ProgramHit[];
};

/** Próg, poniżej którego wyzwanie trafia na mapę „popyt bez podaży”. */
export const GAP_THRESHOLD = 50;
/** Próg, poniżej którego dopytujemy zamiast szukać. */
export const CLARITY_THRESHOLD = 0.6;
/**
 * Progi podobieństwa = jaka część słów kluczowych zapytania pasuje do karty (keyword_search, 0–1).
 * Mentorzy i programy nie przechodzą przez rerank, więc odcinamy je samym progiem.
 */
export const RELATED_MIN_SIMILARITY = 0.25;
export const SIMILAR_INITIATIVE_MIN_SIMILARITY = 0.4;
/** Od tego podobieństwa asystent warsztatu mówi „podobne już istnieje”. */
export const NOVELTY_MIN_SIMILARITY = 0.5;

// ── Automatyczne wykrywanie (Radar 7/10): rekordy ze źródeł i klasyfikator (0008_source_records.sql) ──
export const SOURCES = ["uprp", "epo", "pbn", "ncbr", "interreg"] as const;
export type SourceKey = (typeof SOURCES)[number];
export const SOURCE_LABELS: Record<SourceKey, string> = {
  uprp: "Urząd Patentowy RP", epo: "Europejski Urząd Patentowy", pbn: "Polska Bibliografia Naukowa", ncbr: "NCBR", interreg: "Interreg",
};
export const SOURCE_RECORD_KINDS = ["zgloszenie_patentowe", "patent", "publikacja", "projekt"] as const;
export type SourceRecordKind = (typeof SOURCE_RECORD_KINDS)[number];
export const SOURCE_RECORD_KIND_LABELS: Record<SourceRecordKind, string> = {
  zgloszenie_patentowe: "zgłoszenie patentowe", patent: "patent", publikacja: "publikacja", projekt: "projekt",
};

/** Karta wykrytej inicjatywy: jak InitiativeCard, bez pól, które ustala serwer albo dopowiada twórca. */
export const DetectedCard = InitiativeCard.omit({ municipality: true, clarity: true, followUps: true });
export type DetectedCard = z.infer<typeof DetectedCard>;

/** Wynik klasyfikatora dla rekordu źródłowego (source_records.classification). card = null, gdy to nie kandydat. */
export const SourceClassification = z.object({
  candidate: z.boolean(), // czy z rekordu może wyjść innowacja do wdrożenia, transferu albo komercjalizacji
  reason: z.string().max(400), // jedno zdanie: dlaczego tak albo nie
  card: DetectedCard.nullable(),
});
export type SourceClassification = z.infer<typeof SourceClassification>;

/** Status ochrony wynika z rodzaju rekordu, nie z oceny modelu. */
export const IP_FROM_RECORD: Partial<Record<SourceRecordKind, "zgloszenie" | "patent">> = { zgloszenie_patentowe: "zgloszenie", patent: "patent" };

export type SimilarSource = {
  id: string;
  source: SourceKey;
  kind: SourceRecordKind;
  title: string;
  institution: string | null;
  url: string | null;
  publishedOn: string | null;
  similarity: number;
};

/** Od tej zgodności słów kluczowych rekord źródłowy uznajemy za „podobne rozwiązanie już istnieje”. */
export const SIMILAR_SOURCE_MIN_SIMILARITY = 0.4;

/** „Przejmij zgłoszenie”: twórca albo instytucja potwierdza i uzupełnia kartę wykrytej inicjatywy. */
export const ClaimRequest = z.object({
  code: z.string().trim().toUpperCase().regex(STATUS_CODE),
  card: DetectedCard.pick({
    title: true, summary: true, problem: true, solution: true, effects: true, beneficiaries: true, stage: true,
    innovationKind: true, sectors: true, trl: true, ipStatus: true, creatorRoles: true,
  }),
  confirm: z.literal(true, "Potwierdź, że reprezentujesz twórców albo instytucję"),
});
export type ClaimRequest = z.infer<typeof ClaimRequest>;
