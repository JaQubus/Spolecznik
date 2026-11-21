import { z } from "zod";
import { STATUS_CODE } from "./brand.ts";
import {
  CREATOR_ROLE_KEYS, CROSS_KEYS, DOMAIN_KEYS, INNOVATION_KIND_KEYS, INSTITUTION_KEYS, IP_STATUS_KEYS, SECTOR_KEYS, STAGE_KEYS,
  TRL_MAX, TRL_MIN,
} from "./taxonomy.ts";
import { PATHWAY_KEYS, RADAR_KEYS } from "./taxonomy.ts";
import type { PathwaysView } from "./pathways/view.ts";

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
  // Pole „Nazwa instytucji”: łączymy z instytucją z bazy, gdy nazwa pasuje do dokładnie jednej.
  institution: z.string().trim().max(200).optional(),
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

// /api/threads: wiadomość autora w wątku inicjatywy (wchodzi po kodzie, bez konta)
export const ThreadPostRequest = z.object({
  code: z.string().regex(STATUS_CODE),
  body: z.string().trim().min(2, "Wpisz wiadomość").max(2000, "Wiadomość może mieć najwyżej 2000 znaków"),
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
  similar: { kind: "initiative"; id: string; title: string; similarity: number; slug: string | null }[];
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

/** Dopasowanie z uzasadnieniem: inicjatywa z regionu. */
export type SourceKind = "initiative";

export type Match = RerankItem & {
  matchId: string | null;
  kind: SourceKind;
  title: string;
  slug: string | null;
  gmina: string | null; // tylko inicjatywy
  summary: string | null;
};

export type ProgramHit = { id: string; title: string; closesAt: string | null };

/** Podobna inicjatywa z regionu: opublikowana ma tytuł i link, nieopublikowana tylko gminę (zgłoszenia są prywatne). */
export type SimilarInitiative = { id: string; title: string | null; slug: string | null; gmina: string | null; similarity: number };

export type InitiativeResponse = SubmitResponseBase & {
  similar: SimilarInitiative[];
  /** Ile innych gmin ma podobne inicjatywy (także nieopublikowane) — liczymy gminy, nie zgłoszenia. */
  similarGminy: { count: number; gminy: string[] };
  programs: ProgramHit[];
  /** „Podobne rozwiązanie już istnieje”: patenty, publikacje i projekty ze źródeł (sprawdzanie dublowania, 7/10). */
  similarSources: SimilarSource[];
  /** Wstępne ścieżki rozwoju i dopasowani partnerzy z reguł, przed oceną radaru (6/10); null przy błędzie. */
  pathways?: PathwaysView | null;
};

export type ChallengeResponse = {
  challengeId: string;
  matches: Match[];
  isGap: boolean;
  programs: ProgramHit[];
};

/** Próg, poniżej którego wyzwanie trafia na mapę „popyt bez podaży”. */
export const GAP_THRESHOLD = 50;
/** Próg, poniżej którego dopytujemy zamiast szukać. */
export const CLARITY_THRESHOLD = 0.6;
/**
 * Progi podobieństwa = jaka część słów kluczowych zapytania pasuje do karty (keyword_search, 0–1).
 * Programy nie przechodzą przez rerank, więc odcinamy je samym progiem.
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

// ── Ocena radaru (5/10): odpowiedź modelu przed regułami z lib/radar/score.ts ──
export const RadarModelDimension = z.object({
  key: z.enum(RADAR_KEYS),
  score: z.number().int().min(0).max(5),
  why: z.string().max(400), // jedno zdanie uzasadnienia prostym językiem
  evidence: z.string().max(400), // DOSŁOWNY fragment karty, na którym opiera się ocena; "" gdy karta o tym milczy
  basis: z.enum(["opis", "brak_danych"]),
});
export const RadarModelResult = z.object({
  dimensions: z.array(RadarModelDimension).min(1).max(RADAR_KEYS.length),
  strengths: z.array(z.string().max(300)).max(3),
  risks: z.array(z.string().max(300)).max(3),
});
export type RadarModelResult = z.infer<typeof RadarModelResult>;

/** Panel: ręczna korekta sygnału zawsze z powodem (audit_log). Pusty sygnał = usunięcie korekty. */
export const SignalOverrideInput = z.object({
  initiativeId: z.uuid(),
  signal: z.union([z.literal(""), z.coerce.number().int().min(0).max(100)]),
  reason: z.string().trim().min(10).max(1000),
});

// ── Ścieżki rozwoju (6/10): uzasadnienie i kolejne kroki od modelu. Same ścieżki, mierniki i partnerów liczy kod
// (lib/pathways/), więc model nie może dodać ścieżki ani partnera — opisuje tylko to, co wybrały reguły.
export const PathwayNarrativeItem = z.object({
  key: z.enum(PATHWAY_KEYS),
  why: z.string().max(700), // 2 zdania: dlaczego ta ścieżka pasuje tej innowacji
  nextSteps: z.array(z.string().max(240)).min(1).max(4), // kroki na 12 miesięcy, od czasownika
  metrics: z.array(z.string().max(200)).max(2), // dodatkowe mierniki dopasowane do karty, z terminem
});
export type PathwayNarrativeItem = z.infer<typeof PathwayNarrativeItem>;
export const PathwayNarrative = z.object({ pathways: z.array(PathwayNarrativeItem).min(1).max(3) });
export type PathwayNarrative = z.infer<typeof PathwayNarrative>;

/** Zapis w initiatives.pathways (0009). `keys`: ścieżki z reguł w chwili pisania — po zmianie oceny część może się zestarzeć. */
export type StoredPathways = { items: PathwayNarrativeItem[]; keys: string[]; model: string; generatedAt: string };

/** Odczyt initiatives.pathways: niepoprawny albo pusty zapis daje null zamiast wyjątku na stronie. */
export function readStoredPathways(value: unknown): StoredPathways | null {
  const v = value as Partial<StoredPathways> | null;
  if (!v || typeof v !== "object" || !Array.isArray(v.items)) return null;
  const items = v.items.flatMap((i) => {
    const parsed = PathwayNarrativeItem.safeParse(i);
    return parsed.success ? [parsed.data] : [];
  });
  return items.length ? { items, keys: Array.isArray(v.keys) ? v.keys : [], model: String(v.model ?? ""), generatedAt: String(v.generatedAt ?? "") } : null;
}
