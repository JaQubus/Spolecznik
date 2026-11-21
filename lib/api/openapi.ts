// Specyfikacja OpenAPI 3.1 publicznego API, generowana ze schematów zod w contract.ts —
// zmiana kontraktu od razu zmienia specyfikację (/api/v1/openapi.json) i stronę /api-docs.
import { z } from "zod";
import {
  API_LIMIT_PER_MINUTE, ApiError, Initiative, InitiativeCreatedEvent, InitiativeFeaturedEvent, InitiativeList, InitiativesQuery,
  InitiativeSummary, ProgramChangedEvent,
} from "./contract.ts";
import { brand, org, region } from "../brand.ts";

type Json = Record<string, unknown>;

/** Szum z generatora: granice bezpiecznych liczb całkowitych przy z.int() i długi regex przy z.uuid(). */
function tidy(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(tidy);
  if (!node || typeof node !== "object") return node;
  const out: Json = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "$schema" || k === "$id") continue;
    if ((k === "minimum" || k === "maximum") && Math.abs(v as number) === Number.MAX_SAFE_INTEGER) continue;
    if (k === "pattern" && (node as Json).format === "uuid") continue;
    out[k] = tidy(v);
  }
  return out;
}

const COMPONENTS = [
  InitiativeSummary, Initiative, InitiativeList, ApiError, InitiativeCreatedEvent, InitiativeFeaturedEvent, ProgramChangedEvent,
];

function componentSchemas(): Record<string, Json> {
  const ids = new Set(COMPONENTS.map((s) => z.globalRegistry.get(s)?.id));
  const { schemas } = z.toJSONSchema(z.globalRegistry, { uri: (id) => `#/components/schemas/${id}` });
  return Object.fromEntries(Object.entries(schemas).filter(([id]) => ids.has(id)).map(([id, s]) => [id, tidy(s) as Json]));
}

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });
const json = (id: string, description: string) => ({ description, content: { "application/json": { schema: ref(id) } } });

const ERRORS = {
  "429": {
    ...json("Error", `Za dużo zapytań: najwyżej ${API_LIMIT_PER_MINUTE} na minutę z jednego adresu IP.`),
    headers: { "Retry-After": { description: "Po ilu sekundach spróbować ponownie.", schema: { type: "integer" } } },
  },
  "503": json("Error", "Baza danych jest niedostępna albo nie została skonfigurowana."),
};

function queryParameters() {
  return Object.entries(InitiativesQuery.shape).map(([name, schema]) => {
    const { description, ...rest } = tidy(z.toJSONSchema(schema, { io: "input" })) as Json;
    return { name, in: "query", required: false, description, schema: rest };
  });
}

/** Nagłówki ustawia baza (notify_webhooks w 0003_engagement.sql). */
export const WEBHOOK_HEADERS = [
  { name: "X-Webhook-Event", in: "header", required: true, description: "Nazwa zdarzenia, jak pole event.", schema: { type: "string" } },
  {
    name: "X-Webhook-Signature",
    in: "header",
    required: true,
    description: "sha256=<HMAC-SHA256 surowej treści żądania, klucz: secret z webhook_endpoints, zapis szesnastkowy>.",
    schema: { type: "string", pattern: "^sha256=[0-9a-f]{64}$" },
  },
];

const EVENT_SCHEMA: Record<string, string> = {
  "initiative.created": "InitiativeCreatedEvent",
  "initiative.featured": "InitiativeFeaturedEvent",
  "program.activated": "ProgramChangedEvent",
  "program.deactivated": "ProgramChangedEvent",
};

function webhook(id: string, summary: string, description: string) {
  return {
    post: {
      operationId: id.replace(/\.(\w)/g, (_, c: string) => c.toUpperCase()),
      summary,
      description,
      tags: ["Webhooki"],
      parameters: WEBHOOK_HEADERS,
      requestBody: { required: true, content: { "application/json": { schema: ref(EVENT_SCHEMA[id]) } } },
      responses: { "200": { description: "Odbiorca przyjął zdarzenie. Kod spoza 2xx nie jest ponawiany." } },
    },
  };
}

export function buildOpenApi() {
  return {
    openapi: "3.1.0",
    info: {
      title: `${brand.name} — publiczne API`,
      version: "1.0.0",
      summary: `Opublikowane inicjatywy ${region.genitive} do odczytu i webhooki dla systemów zewnętrznych.`,
      description:
        `Publiczne API serwisu ${brand.name} (${org.name}). Bez klucza i bez danych osobowych: ` +
        "zwraca tylko inicjatywy opublikowane po weryfikacji zespołu. Powiaty identyfikuje kod TERYT. " +
        `Limit: ${API_LIMIT_PER_MINUTE} zapytań na minutę z jednego adresu IP. Opis po polsku: /api-docs.`,
      contact: { name: org.contactName, url: org.url },
    },
    servers: [{ url: "/", description: `Ta instancja serwisu ${brand.name}` }],
    security: [],
    tags: [
      { name: "Inicjatywy", description: "Inicjatywy ze szkół, uczelni, samorządów i instytucji publicznych regionu." },
      { name: "Specyfikacja", description: "Ten dokument." },
      { name: "Webhooki", description: "Zdarzenia, które baza wysyła na zarejestrowane adresy HTTPS." },
    ],
    paths: {
      "/api/v1/inicjatywy": {
        get: {
          operationId: "listInitiatives",
          summary: "Lista inicjatyw",
          description: "Opublikowane inicjatywy od najsilniejszego sygnału, z filtrami. Odpowiedź może być do 5 minut w pamięci podręcznej.",
          tags: ["Inicjatywy"],
          parameters: queryParameters(),
          responses: {
            "200": json("InitiativeList", "Strona listy inicjatyw."),
            "400": json("Error", "Nieprawidłowy parametr zapytania."),
            ...ERRORS,
          },
        },
      },
      "/api/v1/inicjatywy/{slug}": {
        get: {
          operationId: "getInitiative",
          summary: "Jedna inicjatywa",
          description: "Pełny opis opublikowanej inicjatywy: problem, rozwiązanie, efekty.",
          tags: ["Inicjatywy"],
          parameters: [
            { name: "slug", in: "path", required: true, description: "Slug z pola slug albo id (UUID).", schema: { type: "string" } },
          ],
          responses: {
            "200": json("Initiative", "Inicjatywa."),
            "404": json("Error", "Nie ma takiej opublikowanej inicjatywy."),
            ...ERRORS,
          },
        },
      },
      "/api/v1/openapi.json": {
        get: {
          operationId: "getOpenApi",
          summary: "Specyfikacja OpenAPI",
          description: "Ten dokument w formacie JSON.",
          tags: ["Specyfikacja"],
          responses: {
            "200": { description: "Specyfikacja OpenAPI 3.1.", content: { "application/json": { schema: { type: "object" } } } },
          },
        },
      },
    },
    webhooks: {
      "initiative.created": webhook("initiative.created", "Nowa inicjatywa", "Ktoś zgłosił albo wskazał inicjatywę."),
      "initiative.featured": webhook("initiative.featured", "Inicjatywa wyróżniona", "Zespół wyróżnił inicjatywę po weryfikacji."),
      "program.activated": webhook("program.activated", "Program otwarty", "Administrator otworzył program (albo dodał otwarty)."),
      "program.deactivated": webhook("program.deactivated", "Program zamknięty", "Administrator zamknął program."),
    },
    components: { schemas: componentSchemas() },
  };
}

export type OpenApiDocument = ReturnType<typeof buildOpenApi>;
