import type { DomainKey } from "@/lib/taxonomy";

export type { DomainKey };

export const INNOVATION_TYPES = ["przedmiot", "metoda", "usluga", "technologia"] as const;
export type InnovationType = (typeof INNOVATION_TYPES)[number];

export const MATERIAL_KINDS = ["raport", "poradnik", "film", "kanwa", "publikacja", "strona"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export type Source = { title: string; url: string; note?: string };

/** Strona dziedziny (/wiedza/dziedzina/[slug]): opis, wyzwania regionu, polecane materiały. */
export type Domain = {
  key: DomainKey;
  slug: string;
  name: string;
  icon: string;
  lead: string;
  definition: string;
  challenges: string[];
  challengesSource: Source | null;
  reading: string[];
  sort: number;
  published: boolean;
};

export type Fact = {
  id: string;
  domain: DomainKey;
  value: number | null;
  unit: string | null;
  displayValue: string;
  sentence: string;
  dataYear: number | null;
  sourceTitle: string | null;
  sourcePublisher: string | null;
  sourceUrl: string | null;
  sourceYear: number | null;
  sourcePage: number | null;
  quote: string | null;
  /** Bez potwierdzonego źródła — w UI zawsze z etykietą „przykład”. */
  isExample: boolean;
  sort: number;
  published: boolean;
};

export type Material = {
  id: string;
  slug: string;
  kind: MaterialKind;
  title: string;
  description: string | null;
  url: string;
  format: string | null;
  sizeBytes: number | null;
  language: string;
  publisher: string | null;
  domains: DomainKey[];
  year: number | null;
  signLanguage?: boolean;
  captions?: boolean;
  sort: number;
  published: boolean;
};

export type Video = {
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  signLanguage: boolean;
  captions: boolean;
};

/** Sprawdzone rozwiązanie z Polski (Biblioteka Innowacji Społecznych w Krakowie) — tabela patterns. */
export type Pattern = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  domains: DomainKey[];
  crossTopics: string[];
  /** Typy instytucji, które mogą przenieść rozwiązanie do siebie. */
  institutionTypes: string[];
  /** Dziedziny i typ przypisane regułami — admin może je poprawić. */
  domainsAuto: boolean;
  innovationType: InnovationType | null;
  problem: string | null;
  solution: string | null;
  evidence: string | null;
  whoCanUse: string | null;
  howToUse: string | null;
  components: string | null;
  beneficiaries: string | null;
  etrSummary: string | null;
  video: Video | null;
  pdfUrl: string | null;
  materialsZip: { url: string; sizeBytes: number | null; linkOk: boolean } | null;
  licenseUrl: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  dissemination: boolean;
  published: boolean;
  synthetic: boolean;
  /** Liczone triggerem z tabeli adoptions; w trybie plików 0. */
  adoptionsCount: number;
  avgRating: number | null;
};

export type PatternFilter = {
  domain?: DomainKey;
  types?: InnovationType[];
  hasVideo?: boolean;
};

export type MaterialFilter = { kind?: MaterialKind; domain?: DomainKey };

/** Opcje odczytu: `all` = także nieopublikowane (tylko panel admina). */
export type ReadOptions = { all?: boolean };
