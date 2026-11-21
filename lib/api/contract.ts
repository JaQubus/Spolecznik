// Kontrakt publicznego API v1: jedno źródło dla tras app/api/v1, specyfikacji OpenAPI i /api-docs.
// Bez "server-only" i z rozszerzeniami .ts w importach, żeby test jednostkowy (node --test) czytał go wprost.
import { z } from "zod";
import { DOMAIN_KEYS, INSTITUTION_KEYS, STAGE_KEYS, CROSS_KEYS, INNOVATION_KIND_KEYS, SECTOR_KEYS, IP_STATUS_KEYS } from "../taxonomy.ts";
import { brand, region, COUNTY_TERYT } from "../brand.ts";

const tags = (values: readonly string[]) => `Wartości: ${values.join(", ")}.`;

/** Limit zapytań do publicznego API z jednego adresu IP (lib/rate-limit.ts). */
export const API_LIMIT_PER_MINUTE = 60;

// ── Zapytania ──────────────────────────────────────────────
export const InitiativesQuery = z.object({
  dziedzina: z
    .enum(DOMAIN_KEYS, `Podaj jedną z dziedzin: ${DOMAIN_KEYS.join(", ")}`)
    .optional()
    .meta({ description: "Dziedzina inicjatywy (config/taxonomy.json)." }),
  instytucja: z
    .enum(INSTITUTION_KEYS, `Podaj jeden z typów instytucji: ${INSTITUTION_KEYS.join(", ")}`)
    .optional()
    .meta({ description: "Typ instytucji, która prowadzi inicjatywę." }),
  etap: z
    .enum(STAGE_KEYS, `Podaj jeden z etapów: ${STAGE_KEYS.join(", ")}`)
    .optional()
    .meta({ description: "Etap inicjatywy." }),
  typ: z
    .enum(INNOVATION_KIND_KEYS, `Podaj jeden z typów innowacji: ${INNOVATION_KIND_KEYS.join(", ")}`)
    .optional()
    .meta({ description: "Typ innowacji." }),
  sektor: z
    .enum(SECTOR_KEYS, `Podaj jeden z sektorów: ${SECTOR_KEYS.join(", ")}`)
    .optional()
    .meta({ description: "Sektor PCI, któremu innowacja może służyć." }),
  teryt: z
    .string()
    .regex(COUNTY_TERYT, `Podaj kod TERYT powiatu z ${region.genitive}: 4 cyfry, np. ${region.countyExample.teryt}`)
    .optional()
    .meta({ description: "Inicjatywy z powiatu (kod TERYT, 4 cyfry).", examples: [region.countyExample.teryt] }),
  limit: z.coerce
    .number("Podaj liczbę od 1 do 100")
    .int("Podaj liczbę od 1 do 100")
    .min(1, "Podaj liczbę od 1 do 100")
    .max(100, "Podaj liczbę od 1 do 100")
    .default(50)
    .meta({ description: "Ile inicjatyw zwrócić (1–100)." }),
  offset: z.coerce
    .number("Podaj liczbę całkowitą od 0")
    .int("Podaj liczbę całkowitą od 0")
    .min(0, "Podaj liczbę całkowitą od 0")
    .default(0)
    .meta({ description: "Ile inicjatyw pominąć (stronicowanie)." }),
});
export type InitiativesQuery = z.infer<typeof InitiativesQuery>;

// ── Odpowiedzi ─────────────────────────────────────────────
export const InitiativeSummary = z
  .object({
    id: z.uuid(),
    slug: z.string().nullable(),
    title: z.string(),
    url: z.url().meta({ description: `Karta inicjatywy w serwisie ${brand.name}.` }),
    summary: z.string(),
    domains: z.array(z.string()).meta({ description: `Dziedziny. ${tags(DOMAIN_KEYS)}` }),
    institutionType: z.string().nullable().meta({ description: `Typ instytucji. ${tags(INSTITUTION_KEYS)}` }),
    stage: z.string().nullable().meta({ description: `Etap. ${tags(STAGE_KEYS)}` }),
    crossTopics: z.array(z.string()).meta({ description: `Tematy przekrojowe. ${tags(CROSS_KEYS)}` }),
    innovationKind: z.string().nullable().meta({ description: `Typ innowacji. ${tags(INNOVATION_KIND_KEYS)}` }),
    sectors: z.array(z.string()).meta({ description: `Sektory PCI. ${tags(SECTOR_KEYS)}` }),
    trl: z.int().min(1).max(9).nullable().meta({ description: "Poziom gotowości technologicznej 1–9; tylko innowacje technologiczne." }),
    ipStatus: z.string().nullable().meta({ description: `Ochrona własności intelektualnej. ${tags(IP_STATUS_KEYS)}` }),
    institution: z.string().nullable().meta({ description: "Instytucja, w której powstała innowacja (jeśli jest w rejestrze)." }),
    countyTeryt: z.string().nullable().meta({ description: "Kod TERYT powiatu (4 cyfry).", examples: [region.countyExample.teryt] }),
    county: z.string().nullable().meta({ examples: [region.countyExample.name] }),
    municipality: z.string().nullable().meta({ description: "Gmina, w której działa inicjatywa.", examples: [region.municipalityExample.name] }),
    signal: z.int().nullable().meta({ description: "Sygnał radaru 0–100 (po weryfikacji zespołu)." }),
    status: z.string().meta({ description: "featured, supported albo scaling." }),
    nominationsCount: z.int().meta({ description: "Ile osób wskazało tę inicjatywę." }),
    adoptionsCount: z.int().meta({ description: "W ilu miejscach ją przeniesiono (zakończone adopcje)." }),
    avgRating: z.number().nullable().meta({ description: "Średnia ocena po przeniesieniu (1–5)." }),
    synthetic: z.boolean().meta({ description: "true dla danych demonstracyjnych." }),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "InitiativeSummary" });
export type InitiativeSummary = z.infer<typeof InitiativeSummary>;

export const Initiative = InitiativeSummary.extend({
  problem: z.string().nullable(),
  solution: z.string().nullable(),
  effects: z.string().nullable().meta({ description: "Co inicjatywa już dała." }),
  beneficiaries: z.string().nullable(),
}).meta({ id: "Initiative" });
export type Initiative = z.infer<typeof Initiative>;

export const InitiativeList = z
  .object({
    items: z.array(InitiativeSummary),
    total: z.int(),
    limit: z.int(),
    offset: z.int(),
  })
  .meta({ id: "InitiativeList" });
export type InitiativeList = z.infer<typeof InitiativeList>;

export const ApiError = z.object({ error: z.string() }).meta({ id: "Error" });

// ── Webhooki (wysyła baza: supabase/migrations/0003_engagement.sql) ──
export const WEBHOOK_EVENTS = ["initiative.created", "initiative.featured", "program.activated", "program.deactivated"] as const;

export const InitiativeCreatedEvent = z
  .object({
    event: z.literal("initiative.created"),
    occurredAt: z.iso.datetime({ offset: true }),
    data: z.object({
      id: z.uuid(),
      createdAt: z.iso.datetime({ offset: true }),
      submissionKind: z.enum(["own", "nomination", "detected"]).meta({
        description: "own: zgłoszenie autora, nomination: wskazanie cudzej inicjatywy, detected: wykryta w źródłach i przejęta przez twórcę.",
      }),
      domains: z.array(z.string()),
      institutionType: z.string().nullable(),
      stage: z.string().nullable(),
      innovationKind: z.string().nullable(),
      sectors: z.array(z.string()),
      trl: z.int().nullable(),
      countyTeryt: z.string().nullable(),
      synthetic: z.boolean(),
    }),
  })
  .meta({ id: "InitiativeCreatedEvent", description: "Nowe zgłoszenie albo wskazanie. Bez treści: do weryfikacji inicjatywa jest prywatna." });

export const InitiativeFeaturedEvent = z
  .object({
    event: z.literal("initiative.featured"),
    occurredAt: z.iso.datetime({ offset: true }),
    data: z.object({
      id: z.uuid(),
      title: z.string(),
      domains: z.array(z.string()),
      institutionType: z.string().nullable(),
      stage: z.string().nullable(),
      innovationKind: z.string().nullable(),
      sectors: z.array(z.string()),
      trl: z.int().nullable(),
      countyTeryt: z.string().nullable(),
      signal: z.int().nullable(),
      synthetic: z.boolean(),
    }),
  })
  .meta({ id: "InitiativeFeaturedEvent", description: "Zespół wyróżnił inicjatywę po weryfikacji." });

export const ProgramChangedEvent = z
  .object({
    event: z.enum(["program.activated", "program.deactivated"]),
    occurredAt: z.iso.datetime({ offset: true }),
    data: z.object({
      id: z.uuid(),
      title: z.string(),
      active: z.boolean(),
      opensAt: z.iso.date().nullable(),
      closesAt: z.iso.date().nullable(),
      synthetic: z.boolean(),
    }),
  })
  .meta({ id: "ProgramChangedEvent", description: "Program wsparcia otwarty albo zamknięty w Panelu." });

// ── Wiersze widoku public_initiatives → odpowiedzi (tylko kolumny z listy, nigdy select("*")) ──
export const SUMMARY_COLUMNS =
  "id, slug, title, summary, domains, institution_type, stage, cross_topics, innovation_kind, sectors, trl, ip_status, institution_name, " +
  "county_teryt, county, municipality, signal, status, " +
  "nominations_count, adoptions_count, avg_rating, synthetic, created_at, updated_at";
export const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, card`;

export type InitiativeRow = {
  id: string;
  slug: string | null;
  title: string;
  summary: string;
  domains: string[] | null;
  institution_type: string | null;
  stage: string | null;
  cross_topics: string[] | null;
  innovation_kind: string | null;
  sectors: string[] | null;
  trl: number | null;
  ip_status: string | null;
  institution_name: string | null;
  county_teryt: string | null;
  county: string | null;
  municipality: string | null;
  signal: number | null;
  status: string;
  nominations_count: number;
  adoptions_count: number;
  avg_rating: number | string | null; // numeric z PostgREST bywa napisem
  synthetic: boolean;
  created_at: string;
  updated_at: string;
};

export type InitiativeDetailRow = InitiativeRow & {
  card: { problem?: string | null; solution?: string | null; effects?: string | null; beneficiaries?: string | null } | null;
};

/** Strona inicjatywy, jak initiativeHref w lib/knowledge/hrefs.ts (własna kopia: test czyta plik bez aliasu @/). */
export function initiativePath(row: Pick<InitiativeRow, "id" | "slug">): string {
  return `/inicjatywy/${encodeURIComponent(row.slug ?? row.id)}`;
}

export function toSummary(row: InitiativeRow, origin: string): InitiativeSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    url: new URL(initiativePath(row), origin).toString(),
    summary: row.summary,
    domains: row.domains ?? [],
    institutionType: row.institution_type,
    stage: row.stage,
    crossTopics: row.cross_topics ?? [],
    innovationKind: row.innovation_kind,
    sectors: row.sectors ?? [],
    trl: row.trl,
    ipStatus: row.ip_status,
    institution: row.institution_name,
    countyTeryt: row.county_teryt,
    county: row.county,
    municipality: row.municipality,
    signal: row.signal,
    status: row.status,
    nominationsCount: row.nominations_count,
    adoptionsCount: row.adoptions_count,
    avgRating: row.avg_rating == null ? null : Math.round(Number(row.avg_rating) * 10) / 10,
    synthetic: row.synthetic,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toInitiative(row: InitiativeDetailRow, origin: string): Initiative {
  const card = row.card ?? {};
  return {
    ...toSummary(row, origin),
    problem: card.problem ?? null,
    solution: card.solution ?? null,
    effects: card.effects ?? null,
    beneficiaries: card.beneficiaries ?? null,
  };
}
