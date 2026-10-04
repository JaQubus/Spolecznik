import type { GROUPS, MWS_AREAS } from "@/lib/schemas";

export type AreaKey = (typeof MWS_AREAS)[number];
export type GroupKey = (typeof GROUPS)[number];

export const INNOVATION_TYPES = ["przedmiot", "metoda", "usluga", "technologia"] as const;
export type InnovationType = (typeof INNOVATION_TYPES)[number];

export const MATERIAL_KINDS = ["raport", "poradnik", "film", "kanwa", "publikacja"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export type Source = { title: string; url: string; note?: string };

export type Area = {
  key: AreaKey;
  slug: string;
  name: string;
  icon: string;
  lead: string;
  definition: string;
  challenges: string[];
  challengesSource: Source | null;
  reading: string[];
  personaKeys: string[];
  sort: number;
  published: boolean;
};

export type Fact = {
  id: string;
  area: AreaKey;
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
  kind: MaterialKind;
  title: string;
  description: string | null;
  url: string;
  format: string | null;
  sizeBytes: number | null;
  language: string;
  areas: AreaKey[];
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

export type Innovation = {
  id: string;
  slug: string;
  title: string;
  groups: GroupKey[];
  areas: AreaKey[];
  /** Obszary i typ przypisane regułami — admin może je poprawić. */
  areasAuto: boolean;
  innovationType: InnovationType | null;
  typeAuto: boolean;
  problem: string | null;
  solution: string | null;
  evidence: string | null;
  whoCanUse: string | null;
  /** Z karty PDF (pipeline dopasowań); w Zasobniku zwykle puste. */
  howToUse?: string | null;
  components?: string | null;
  beneficiaries: string | null;
  etrSummary: string | null;
  video: Video | null;
  pdfUrl: string | null;
  materialsZip: { url: string; sizeBytes: number | null; linkOk: boolean } | null;
  licenseUrl: string | null;
  sourceUrl: string | null;
  dissemination: boolean;
  published: boolean;
  synthetic: boolean;
  /** Liczone triggerem z tabeli tests (Próba); brak w trybie plików. */
  testsCount?: number;
  avgRating?: number | null;
};

export type Persona = {
  key: string;
  name: string;
  age: number | null;
  area: AreaKey;
  about: string[];
  needs: string[];
  query: string;
  innovationSlugs: string[];
  gap: string | null;
};

export type InnovationFilter = {
  area?: AreaKey;
  group?: GroupKey;
  types?: InnovationType[];
  hasVideo?: boolean;
};

export type MaterialFilter = { kind?: MaterialKind; area?: AreaKey };

/** Opcje odczytu: `all` = także nieopublikowane (tylko panel admina). */
export type ReadOptions = { all?: boolean };
