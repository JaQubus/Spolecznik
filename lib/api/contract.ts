// Kontrakt publicznego API v1 (#67): jedno źródło dla tras app/api/v1, specyfikacji OpenAPI i /api-docs.
// Bez "server-only" i z rozszerzeniami .ts w importach, żeby test jednostkowy (node --test) czytał go wprost.
import { z } from "zod";
import { GROUPS, MWS_AREAS } from "../schemas.ts";

const tags = (values: readonly string[]) => `Wartości: ${values.join(", ")}.`;

/** Limit zapytań do publicznego API z jednego adresu IP (lib/rate-limit.ts). */
export const API_LIMIT_PER_MINUTE = 60;

// ── Zapytania ──────────────────────────────────────────────
export const InnovationsQuery = z.object({
  obszar: z
    .enum(MWS_AREAS, `Podaj jeden z obszarów: ${MWS_AREAS.join(", ")}`)
    .optional()
    .meta({ description: "Obszar Mapy Wyzwań Społecznych." }),
  grupa: z
    .enum(GROUPS, `Podaj jedną z grup: ${GROUPS.join(", ")}`)
    .optional()
    .meta({ description: "Grupa docelowa z Biblioteki Innowacji." }),
  teryt: z
    .string()
    .regex(/^12\d{2}$/, "Podaj kod TERYT powiatu z Małopolski: 4 cyfry, np. 1201")
    .optional()
    .meta({ description: "Innowacje testowane w powiecie (kod TERYT, 4 cyfry). Gmin nie podajemy: wskazywałyby instytucję.", examples: ["1201"] }),
  limit: z.coerce
    .number("Podaj liczbę od 1 do 100")
    .int("Podaj liczbę od 1 do 100")
    .min(1, "Podaj liczbę od 1 do 100")
    .max(100, "Podaj liczbę od 1 do 100")
    .default(50)
    .meta({ description: "Ile innowacji zwrócić (1–100)." }),
  offset: z.coerce
    .number("Podaj liczbę całkowitą od 0")
    .int("Podaj liczbę całkowitą od 0")
    .min(0, "Podaj liczbę całkowitą od 0")
    .default(0)
    .meta({ description: "Ile innowacji pominąć (stronicowanie)." }),
});
export type InnovationsQuery = z.infer<typeof InnovationsQuery>;

// ── Odpowiedzi ─────────────────────────────────────────────
export const InnovationSummary = z
  .object({
    id: z.uuid(),
    slug: z.string().nullable(),
    title: z.string(),
    url: z.url().meta({ description: "Karta innowacji w Społeczniku." }),
    category: z.string().nullable(),
    innovationType: z.string().nullable().meta({ description: "przedmiot, metoda, usluga albo technologia." }),
    areas: z.array(z.string()).meta({ description: `Obszary Mapy Wyzwań. ${tags(MWS_AREAS)}` }),
    targetGroups: z.array(z.string()).meta({ description: `Grupy docelowe. ${tags(GROUPS)}` }),
    crossTopics: z.array(z.string()).meta({ description: "Tematy przekrojowe z briefu ROPS." }),
    solution: z.string().nullable().meta({ description: "Na czym polega rozwiązanie." }),
    easyToRead: z.string().nullable().meta({ description: "Opis w tekście łatwym do czytania (ETR)." }),
    testsCount: z.int().meta({ description: "Liczba zgłoszonych testów w gminach." }),
    avgRating: z.number().nullable().meta({ description: "Średnia ocena po testach (1–5)." }),
    synthetic: z.boolean().meta({ description: "true dla danych demonstracyjnych." }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "InnovationSummary" });
export type InnovationSummary = z.infer<typeof InnovationSummary>;

export const TestedIn = z
  .object({
    teryt: z.string().meta({ description: "Kod TERYT powiatu (4 cyfry).", examples: ["1201"] }),
    powiat: z.string().nullable().meta({ examples: ["bocheński"] }),
    planned: z.int().meta({ description: "Testy zaplanowane." }),
    completed: z.int().meta({ description: "Testy zakończone." }),
  })
  .meta({ id: "TestedIn" });

export const Innovation = InnovationSummary.extend({
  problem: z.string().nullable(),
  beneficiaries: z.string().nullable(),
  whoCanUse: z.string().nullable(),
  evidence: z.string().nullable(),
  howToUse: z.string().nullable(),
  components: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  pdfUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  licenseUrl: z.string().nullable(),
  testedIn: z.array(TestedIn).meta({ description: "Powiaty, w których innowację testowano, z kodami TERYT." }),
}).meta({ id: "Innovation" });
export type Innovation = z.infer<typeof Innovation>;

export const InnovationList = z
  .object({
    items: z.array(InnovationSummary),
    total: z.int(),
    limit: z.int(),
    offset: z.int(),
  })
  .meta({ id: "InnovationList" });
export type InnovationList = z.infer<typeof InnovationList>;

export const ApiError = z.object({ error: z.string() }).meta({ id: "Error" });

// ── Webhooki (wysyła baza: supabase/migrations/0023_webhooks.sql) ──
export const WEBHOOK_EVENTS = ["idea.created", "call.activated", "call.deactivated"] as const;

export const IdeaCreatedEvent = z
  .object({
    event: z.literal("idea.created"),
    occurredAt: z.iso.datetime({ offset: true }),
    data: z.object({
      id: z.uuid(),
      createdAt: z.iso.datetime({ offset: true }),
      status: z.string(),
      needAreas: z.array(z.string()).meta({ description: "Obszary potrzeby, z której wyrósł pomysł (pusta lista bez potrzeby)." }),
      synthetic: z.boolean(),
    }),
  })
  .meta({ id: "IdeaCreatedEvent", description: "Nowy pomysł z Pracowni. Bez treści: pomysły są prywatne do czasu moderacji." });

export const CallChangedEvent = z
  .object({
    event: z.enum(["call.activated", "call.deactivated"]),
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
  .meta({ id: "CallChangedEvent", description: "Nabór otwarty albo zamknięty w Panelu." });

// ── Wiersze bazy → odpowiedzi (tylko kolumny z listy, nigdy select("*")) ──
export const SUMMARY_COLUMNS =
  "id, slug, title, category, innovation_type, areas, target_groups, cross_topics, solution, etr_summary, tests_count, avg_rating, synthetic, updated_at";
export const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, problem, beneficiaries, who_can_use, evidence, how_to_use, components, source_url, pdf_url, video_url, license_url`;

export type InnovationRow = {
  id: string;
  slug: string | null;
  title: string;
  category: string | null;
  innovation_type: string | null;
  areas: string[] | null;
  target_groups: string[] | null;
  cross_topics: string[] | null;
  solution: string | null;
  etr_summary: string | null;
  tests_count: number;
  avg_rating: number | string | null; // numeric z PostgREST bywa napisem
  synthetic: boolean;
  updated_at: string;
};

export type InnovationDetailRow = InnovationRow & {
  problem: string | null;
  beneficiaries: string | null;
  who_can_use: string | null;
  evidence: string | null;
  how_to_use: string | null;
  components: string | null;
  source_url: string | null;
  pdf_url: string | null;
  video_url: string | null;
  license_url: string | null;
};

/**
 * Kanoniczna strona opisu, jak innovationHref w lib/knowledge/hrefs.ts: jedna dla Zasobnika i pipeline'u dopasowań,
 * innowacja bez sluga — po id. Stare /biblioteka/[slug] tylko przekierowuje, więc go nie zwracamy.
 * Własna kopia, bo ten plik czyta też test jednostkowy (node --test, bez aliasu @/).
 */
export function innovationPath(row: Pick<InnovationRow, "id" | "slug">): string {
  return `/biblioteka/innowacja/${encodeURIComponent(row.slug ?? row.id)}`;
}

export function toSummary(row: InnovationRow, origin: string): InnovationSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    url: new URL(innovationPath(row), origin).toString(),
    category: row.category,
    innovationType: row.innovation_type,
    areas: row.areas ?? [],
    targetGroups: row.target_groups ?? [],
    crossTopics: row.cross_topics ?? [],
    solution: row.solution,
    easyToRead: row.etr_summary,
    testsCount: row.tests_count,
    avgRating: row.avg_rating == null ? null : Math.round(Number(row.avg_rating) * 10) / 10,
    synthetic: row.synthetic,
    updatedAt: row.updated_at,
  };
}

export function toInnovation(row: InnovationDetailRow, testedIn: Innovation["testedIn"], origin: string): Innovation {
  return {
    ...toSummary(row, origin),
    problem: row.problem,
    beneficiaries: row.beneficiaries,
    whoCanUse: row.who_can_use,
    evidence: row.evidence,
    howToUse: row.how_to_use,
    components: row.components,
    sourceUrl: row.source_url,
    pdfUrl: row.pdf_url,
    videoUrl: row.video_url,
    licenseUrl: row.license_url,
    testedIn,
  };
}

/**
 * Testy (teryt gminy, status) → liczby na powiat (pierwsze 4 cyfry kodu). Gmina z innowacją wskazywałaby
 * instytucję (migracja 0022_tests_private), więc nie wychodzi z serwera — tak samo jak treść ocen i dane testujących.
 */
export function summarizeTests(
  tests: { teryt: string | null; status: string }[],
  powiaty: ReadonlyMap<string, string>,
): Innovation["testedIn"] {
  const byPowiat = new Map<string, { planned: number; completed: number }>();
  for (const t of tests) {
    if (!t.teryt) continue;
    const teryt = t.teryt.slice(0, 4);
    const c = byPowiat.get(teryt) ?? { planned: 0, completed: 0 };
    if (t.status === "zakonczony") c.completed++;
    else c.planned++;
    byPowiat.set(teryt, c);
  }
  return [...byPowiat]
    .map(([teryt, c]) => ({ teryt, powiat: powiaty.get(teryt) ?? null, ...c }))
    .sort((a, b) => b.completed + b.planned - (a.completed + a.planned) || a.teryt.localeCompare(b.teryt));
}
