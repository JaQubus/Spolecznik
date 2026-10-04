import type { AssistantResponse, ImplementationCard, MatchResponse, NeedCard } from "../../lib/schemas";

// Odpowiedzi AI podstawiane w makietach zamiast wywołania Groq (page.route). Wyłącznie dane syntetyczne:
// opis z README §13 (pani Halina to postać fikcyjna), ekspert i nabór z data/seed_synthetic.py,
// innowacje to prawdziwe karty z Biblioteki (publiczne, bez danych osobowych).

export const DEMO_TEXT =
  "Seniorzy w przysiółkach są samotni. Autobus jeździ dwa razy dziennie, więc nie mają jak dojechać do klubu seniora ani do lekarza.";

/** Kod przykładowy z README §6 — nie istnieje w bazie, więc linki ze zrzutu nie odsłaniają prawdziwego zgłoszenia. */
const CODE = "SPL-4K7Q";

const card: NeedCard = {
  summary: "Starsze osoby z oddalonych przysiółków są samotne i nie mają jak dojechać do klubu seniora ani do lekarza.",
  areas: ["seniorzy"],
  groups: ["seniorzy", "ograniczona_mobilnosc"],
  cross: ["samotnosc", "dostep_do_uslug", "depopulacja_suburbanizacja"],
  gmina: null,
  keywords: ["senior", "samotność", "przysiółek", "transport", "klub seniora", "dostęp do lekarza"],
  alreadyTried: null,
  clarity: 0.9,
  followUp: null,
};

export const intakeFollowUp = {
  card: { ...card, clarity: 0.5, followUp: "Czy seniorzy mieszkają sami, czy z rodziną, która wyjeżdża do pracy?" },
  needsFollowUp: true,
  piiFound: false,
};

export const intakeClear = { card, needsFollowUp: false, piiFound: false };

const need = { id: "00000000-0000-4000-8000-000000000001", statusCode: CODE, accessKey: "makieta-bez-dostepu", gmina: null };

const common = {
  need,
  similarNeeds: { count: 4, gminy: ["Łukowica", "Kamienica", "Jodłownik", "Tymbark"] },
  experts: [{
    id: "00000000-0000-4000-8000-000000000002",
    name: "dr Ewa Przykładowa (ekspert demo)",
    description: "gerontolożka, 15 lat w dziennych domach pomocy; usługi sąsiedzkie i samotność seniorów",
  }],
  calls: [{ id: "00000000-0000-4000-8000-000000000003", title: "Inkubator Włączenia Społecznego — nabór jesienny 2026 (demo)", closesAt: "2026-11-30" }],
};

const match = (n: number, slug: string, title: string, fit: number, why: string, adapt: string, tests = 0, rating: number | null = null) => ({
  matchId: `00000000-0000-4000-8000-00000000010${n}`,
  id: slug, // /wdrozenie i /przetestuj przyjmują też slug zamiast id
  slug,
  title,
  category: "dla seniorów",
  etrSummary: null,
  fit,
  why,
  adapt,
  testsCount: tests,
  avgRating: rating,
});

export const matchFound: MatchResponse = {
  ...common,
  isGap: false,
  matches: [
    match(1, "senior-cuder", "Senior CUDER", 86,
      "Łączy seniorów z wolontariuszami, którzy odwiedzają ich w domu, więc nie wymaga dojazdu z przysiółka.",
      "Zacznijcie od przysiółków bez autobusu; wolontariuszy szukajcie w kole gospodyń i szkole.", 4, 4.3),
    match(2, "senior-w-sieci-gminy", "Senior w Sieci Gminy", 72,
      "Część spraw (e-recepta, rozmowa z lekarzem, spotkania klubu) seniorzy załatwią przez internet, bez wyjazdu.",
      "Potrzebny sprzęt i jedna osoba w GOPS, która pomoże przy pierwszym połączeniu."),
    match(3, "starszy-brat-starsza-siostra", "Starszy Brat, Starsza Siostra", 61,
      "Stały opiekun-wolontariusz zmniejsza samotność i może pomagać w organizacji dojazdów.",
      "Model był robiony w mieście — na wsi trzeba policzyć czas dojazdu wolontariuszy."),
  ],
};

export const matchGap: MatchResponse = { ...common, isGap: true, matches: [] };

export const aiBusy = { error: "Za dużo zapytań do AI naraz" };

export const implementation: { innovation: { id: string; title: string }; gmina: { teryt: string; nazwa: string }; card: ImplementationCard & { partners: { id: string; role: string; name: string }[] } } = {
  innovation: { id: "senior-cuder", title: "Senior CUDER" },
  gmina: { teryt: "1206052", nazwa: "Kamienica" },
  card: {
    goal: "Zmniejszyć samotność seniorów z przysiółków przez regularne odwiedziny wolontariuszy i wspólne wyjazdy.",
    audience: "Ok. 1 300 osób w wieku 65+ (dane syntetyczne do makiety), z czego część mieszka sama w oddalonych przysiółkach.",
    serviceForm: "Usługa sąsiedzka prowadzona przez GOPS we współpracy z kołem gospodyń wiejskich.",
    steps: [
      "Zebrać listę seniorów, którzy chcą odwiedzin (sołtysi, GOPS).",
      "Zrekrutować i przeszkolić 10 wolontariuszy.",
      "Ustalić stały grafik odwiedzin i raz w miesiącu wspólny wyjazd.",
      "Po 3 miesiącach zapytać seniorów, co zmienić.",
    ],
    staffAndResources: "Koordynator na pół etatu, zwrot kosztów dojazdu wolontariuszy, telefon dyżurny.",
    costEstimate: { minPln: 40_000, maxPln: 65_000, basis: "Szacunek dla 10 wolontariuszy i koordynatora na pół etatu." },
    partners: [{ id: "00000000-0000-4000-8000-000000000002", role: "konsultacje przy szkoleniu wolontariuszy", name: "dr Ewa Przykładowa (ekspert demo)" }],
    risks: ["Wolontariusze rezygnują po kilku miesiącach.", "Seniorzy nie ufają obcym osobom."],
    successIndicators: ["Liczba seniorów odwiedzanych co tydzień.", "Ocena samopoczucia w krótkiej ankiecie po 3 miesiącach."],
    assumptions: ["Koło gospodyń wiejskich zgodzi się współprowadzić usługę.", "Gmina ma środki na zwrot kosztów dojazdu."],
  },
};

export const assistant: AssistantResponse = {
  reply:
    "Podobne rozwiązanie już działa: Senior CUDER łączy seniorów z wolontariuszami. Twój pomysł może się wyróżnić tym, " +
    "że łączy odwiedziny z dowozem do klubu seniora. Kto w gminie mógłby prowadzić taki dowóz?",
  similar: [
    { kind: "innowacja", id: "senior-cuder", title: "Senior CUDER", similarity: 0.62, slug: "senior-cuder" },
    { kind: "pomysl", id: "00000000-0000-4000-8000-000000000004", title: "Sąsiedzki bus dla seniorów (demo)", similarity: 0.51, slug: null },
  ],
};
