import data from "../config/taxonomy.json" with { type: "json" };

/**
 * Słowniki Radaru. Treść (etykiety, opisy do promptów, wagi radaru) jest w config/taxonomy.json — ten sam plik
 * czyta pipeline Pythona (data/common.py). Krotki kluczy są tu wpisane jawnie, bo z.enum i wyczerpujące
 * Record<Klucz, Ikona> potrzebują literałów; test tests/unit/taxonomy.test.ts pilnuje zgodności z JSON-em.
 */
export const DOMAIN_KEYS = [
  "edukacja", "nauka", "cyfryzacja", "administracja", "srodowisko", "zdrowie", "uslugi_spoleczne", "mobilnosc",
  "kultura", "gospodarka", "partycypacja",
] as const;
export const INSTITUTION_KEYS = [
  "szkola_podstawowa", "szkola_ponadpodstawowa", "uczelnia", "gmina", "powiat", "kultura", "pomoc_zdrowie", "inna",
] as const;
export const STAGE_KEYS = ["pomysl", "pilotaz", "dziala", "przeniesiona"] as const;
export const CROSS_KEYS = [
  "obszary_wiejskie", "depopulacja", "mlodzi", "seniorzy", "wykluczenie_cyfrowe", "wspolpraca", "pogranicze",
] as const;
/** Wymiary oceny radaru (metodologia 2, 5/10): kolejność jak na stronie /metodologia. */
export const RADAR_KEYS = ["nowosc", "wplyw", "dojrzalosc", "skalowalnosc", "komercjalizacja"] as const;
export const INNOVATION_KIND_KEYS = ["technologiczna", "organizacyjna", "edukacyjna", "spoleczna", "procesowa"] as const;
/** Sektory PCI (inteligentne specjalizacje regionu); „inne”, gdy żaden nie pasuje. */
export const SECTOR_KEYS = ["lotnictwo_kosmos", "motoryzacja", "jakosc_zycia", "ict", "inne"] as const;
export const IP_STATUS_KEYS = ["brak", "zgloszenie", "patent", "wzor", "open"] as const;
export const CREATOR_ROLE_KEYS = ["uczen", "student", "nauczyciel", "naukowiec", "urzednik"] as const;
export const PARTNER_KIND_KEYS = ["firma", "fundusz", "ctt", "pci", "jst"] as const;
export const PARTNER_SUPPORT_KEYS = ["licencja", "inwestycja", "pilotaz", "zakup", "mentoring"] as const;
/** Skala gotowości technologicznej. Tylko dla innowacji technologicznych. */
export const TRL_MIN = 1;
export const TRL_MAX = 9;

export type DomainKey = (typeof DOMAIN_KEYS)[number];
export type InstitutionKey = (typeof INSTITUTION_KEYS)[number];
export type StageKey = (typeof STAGE_KEYS)[number];
export type CrossKey = (typeof CROSS_KEYS)[number];
export type RadarKey = (typeof RADAR_KEYS)[number];
export type InnovationKindKey = (typeof INNOVATION_KIND_KEYS)[number];
export type SectorKey = (typeof SECTOR_KEYS)[number];
export type IpStatusKey = (typeof IP_STATUS_KEYS)[number];
export type CreatorRoleKey = (typeof CREATOR_ROLE_KEYS)[number];
export type PartnerKindKey = (typeof PARTNER_KIND_KEYS)[number];
export type PartnerSupportKey = (typeof PARTNER_SUPPORT_KEYS)[number];

export type TaxonomyEntry = { label: string; slug: string; description: string };
export type RadarDimension = { label: string; short: string; question: string; anchors: Record<string, string> };
export type SignalLevel = { min: number; key: string; label: string };

export const DOMAINS = data.domains as Record<DomainKey, TaxonomyEntry>;
export const INSTITUTION_TYPES = data.institutionTypes as Record<InstitutionKey, TaxonomyEntry>;
export const STAGES = data.stages as Record<StageKey, TaxonomyEntry>;
export const CROSS = data.cross as Record<CrossKey, TaxonomyEntry>;
export const INNOVATION_KINDS = data.innovationKinds as Record<InnovationKindKey, TaxonomyEntry>;
export const SECTORS = data.sectors as Record<SectorKey, TaxonomyEntry>;
export const IP_STATUSES = data.ipStatuses as Record<IpStatusKey, TaxonomyEntry>;
export const CREATOR_ROLES = data.creatorRoles as Record<CreatorRoleKey, TaxonomyEntry>;
export const PARTNER_KINDS = data.partnerKinds as Record<PartnerKindKey, TaxonomyEntry>;
export const PARTNER_SUPPORT = data.partnerSupport as Record<PartnerSupportKey, TaxonomyEntry>;
/** Opisy poziomów TRL, klucz to liczba 1–9 jako tekst. */
export const TRL_LEVELS = data.trl as Record<string, TaxonomyEntry>;

/** Zestaw wag: typ innowacji albo „domyslne”, gdy typu nie znamy (karta sprzed 4/10). */
export type RadarWeightsKey = InnovationKindKey | "domyslne";

export const RADAR = data.radar as unknown as {
  methodologyVersion: number;
  dimensions: Record<RadarKey, RadarDimension>;
  /** Wagi wymiarów dla każdego typu innowacji; każdy zestaw sumuje się do 1. */
  weights: Record<RadarWeightsKey, Record<RadarKey, number>>;
  /** Najwyższa ocena dojrzałości dla etapu: pomysł nie może być „sprawdzony w praktyce”. */
  maturityCap: Record<StageKey, number>;
  /** Najwyższa ocena dojrzałości dla poziomu TRL (klucz 1–9 jako tekst) — tylko innowacje technologiczne. */
  trlMaturityCap: Record<string, number>;
  /** Inicjatywa już przeniesiona gdzie indziej ma co najmniej tyle za skalowalność i przenaszalność. */
  transferredMinScalability: number;
  /** Ocena wymiaru, o którym opis nic nie mówi (basis = brak_danych), nie przekracza tej wartości. */
  noDataMax: number;
  /** Od najwyższego progu. */
  levels: SignalLevel[];
};

export function signalLevel(signal: number): SignalLevel {
  return RADAR.levels.find((l) => signal >= l.min) ?? RADAR.levels[RADAR.levels.length - 1];
}

/** Etykiety do list i plakietek. Nieznany klucz (np. z ręcznej edycji w bazie) pokazujemy dosłownie. */
export const domainLabel = (k: string) => DOMAINS[k as DomainKey]?.label ?? k;
export const institutionLabel = (k: string) => INSTITUTION_TYPES[k as InstitutionKey]?.label ?? k;
export const stageLabel = (k: string) => STAGES[k as StageKey]?.label ?? k;
export const crossLabel = (k: string) => CROSS[k as CrossKey]?.label ?? k;
export const innovationKindLabel = (k: string) => INNOVATION_KINDS[k as InnovationKindKey]?.label ?? k;
export const sectorLabel = (k: string) => SECTORS[k as SectorKey]?.label ?? k;
export const ipStatusLabel = (k: string) => IP_STATUSES[k as IpStatusKey]?.label ?? k;
export const creatorRoleLabel = (k: string) => CREATOR_ROLES[k as CreatorRoleKey]?.label ?? k;
export const partnerKindLabel = (k: string) => PARTNER_KINDS[k as PartnerKindKey]?.label ?? k;
export const partnerSupportLabel = (k: string) => PARTNER_SUPPORT[k as PartnerSupportKey]?.label ?? k;
/** Przedziały TRL etapów (config/taxonomy.json → trlStage), bez klucza „_opis”. */
const TRL_RANGES = Object.entries(data.trlStage).filter((e): e is [StageKey, [number, number]] => Array.isArray(e[1]));
/** Etap, który odpowiada poziomowi TRL; ten sam przedział daje data/common.py (stage_for_trl). */
export function stageForTrl(trl: number): StageKey {
  const hit = TRL_RANGES.find(([, [from, to]]) => trl >= from && trl <= to);
  return hit?.[0] ?? (trl > TRL_MAX ? "dziala" : "pomysl");
}

/** „TRL 4: model sprawdzony w laboratorium”. */
export const trlLabel = (n: number) => (TRL_LEVELS[String(n)] ? `${TRL_LEVELS[String(n)].label}: ${TRL_LEVELS[String(n)].description}` : `TRL ${n}`);

/** Kategorie Biblioteki Innowacji Społecznych (patterns.category) — tylko do podpisu źródła rozwiązania. */
export const PATTERN_CATEGORY_LABELS: Record<string, string> = {
  seniorzy: "Dla seniorów",
  dzieci_mlodziez_rodzina: "Dla dzieci, młodzieży i rodziny",
  ograniczona_mobilnosc: "Dla osób o ograniczonej mobilności",
  niepelnosprawnosc_sensoryczna: "Dla osób z niepełnosprawnością sensoryczną",
  zdrowie_medycyna: "Dla zdrowia i medycyny",
  rynek_pracy: "Dla rynku pracy",
  cudzoziemcy: "Dla cudzoziemców",
  bezdomnosc: "Dla osób w kryzysie bezdomności",
  niepelnosprawnosc_intelektualna: "Dla osób z niepełnosprawnością intelektualną",
};

/** Typ gminy z 7. cyfry kodu TERYT: 1 miejska, 2 wiejska, 3 miejsko-wiejska. */
export function gminaType(teryt: string): "miejska" | "wiejska" | "miejsko-wiejska" | null {
  const d = teryt.charAt(6);
  if (d === "1") return "miejska";
  if (d === "2") return "wiejska";
  if (d === "3") return "miejsko-wiejska";
  return null;
}

// ── Ścieżki rozwoju i dopasowanie partnerów (6/10). Reguły i mierniki: config/taxonomy.json → pathways, pathwayRules ──

export const PATHWAY_KEYS = ["wdrozenie", "komercjalizacja", "rozwoj", "ochrona_ip", "upowszechnienie"] as const;
export type PathwayKey = (typeof PATHWAY_KEYS)[number];
/** Lejek PCI w kolejności (advance_funnel w 0009 przesuwa tylko do przodu). */
export const FUNNEL_KEYS = [
  "wykryta", "zweryfikowana", "oceniona", "skierowana", "w_realizacji", "wdrozona", "skomercjalizowana", "zarchiwizowana",
] as const;
export type FunnelKey = (typeof FUNNEL_KEYS)[number];

export type PathwayVariant = { label: string; metrics: string[]; metricsByKind?: Partial<Record<InnovationKindKey, string[]>> };
export type PathwayKind = {
  label: string;
  description: string;
  /** Formy wsparcia partnera (partnerSupport), które pomagają na tej ścieżce. */
  partnerSupport: PartnerSupportKey[];
  /** Rodzaje partnerów (partnerKinds), którzy zwykle prowadzą tę ścieżkę. */
  partnerKinds: PartnerKindKey[];
  /** „Kto pomaga”: role i programy, bez nazw osób. */
  helpers: string[];
  variants: Record<string, PathwayVariant>;
};

/** Warunek reguły: wszystkie podane pola muszą być spełnione. Pola radaru nie działają bez oceny radaru. */
export type PathwayCondition = {
  kinds?: InnovationKindKey[];
  notKinds?: InnovationKindKey[];
  trlMin?: number;
  trlMax?: number;
  stages?: StageKey[];
  /** Ma sektor PCI inny niż „inne”. */
  sectorPci?: boolean;
  ip?: IpStatusKey[];
  /** Brak ochrony: ip_status puste albo „brak”. */
  ipMissing?: boolean;
  radarMin?: Partial<Record<RadarKey, number>>;
  radarMax?: Partial<Record<RadarKey, number>>;
  easeMin?: number;
  /** Wśród twórców są uczniowie albo studenci (osoby w wieku 16–30 lat, laboratoria PCI). */
  youth?: boolean;
  institutionTypes?: InstitutionKey[];
};
export type PathwayRule = { pathway: PathwayKey; variant: string; points: number; when: PathwayCondition; reason: string };

export const PATHWAYS = data.pathways as unknown as {
  minPoints: number;
  minPointsWithoutRadar: number;
  max: number;
  kinds: Record<PathwayKey, PathwayKind>;
};
export const PATHWAY_RULES = data.pathwayRules as unknown as PathwayRule[];
export const PATHWAY_FALLBACK = data.pathwayFallback as unknown as Record<"technologiczna" | "pomysl" | "default", [PathwayKey, string]>;
export const EASE_OF_ADOPTION = data.easeOfAdoption as unknown as {
  kindBase: Record<InnovationKindKey, number>;
  weights: { skalowalnosc: number; dojrzalosc: number; kind: number };
  transferredBonus: number;
  levels: { min: number; label: string }[];
};
export const PARTNER_MATCHING = data.partnerMatching as unknown as {
  points: { sector: number; domain: number; domainMax: number; maturity: number; support: number; kind: number; keywords: number; county: number };
  /** Tyle wspólnych słów daje pełne punkty za słowa kluczowe. */
  keywordsFull: number;
  minScore: number;
  perKind: Record<PartnerKindKey, number>;
  max: number;
  challengeMinScore: number;
  challengeMax: number;
};
export const FUNNEL = Object.fromEntries(Object.entries(data.funnel).filter(([k]) => k !== "_opis")) as unknown as Record<FunnelKey, TaxonomyEntry>;

export const pathwayLabel = (k: string) => PATHWAYS.kinds[k as PathwayKey]?.label ?? k;
export const funnelLabel = (k: string) => FUNNEL[k as FunnelKey]?.label ?? k;
