// Specyfikacja OpenAPI 3.1 publicznego API, generowana ze schematów zod w contract.ts —
// zmiana kontraktu od razu zmienia specyfikację (/api/v1/openapi.json) i stronę /api-docs.
import { z } from "zod";
import {
  API_LIMIT_PER_MINUTE, ApiError, CallChangedEvent, IdeaCreatedEvent, Innovation, InnovationList, InnovationsQuery, InnovationSummary, TestedIn,
} from "./contract.ts";

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

const COMPONENTS = [InnovationSummary, TestedIn, Innovation, InnovationList, ApiError, IdeaCreatedEvent, CallChangedEvent];

function componentSchemas(): Record<string, Json> {
  const ids = new Set(COMPONENTS.map((s) => z.globalRegistry.get(s)?.id));
  const { schemas } = z.toJSONSchema(z.globalRegistry, { uri: (id) => `#/components/schemas/${id}` });
  return Object.fromEntries(Object.entries(schemas).filter(([id]) => ids.has(id)).map(([id, s]) => [id, tidy(s) as Json]));
}

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });
const json = (id: string, description: string) => ({ description, content: { "application/json": { schema: ref(id) } } });

const ERRORS = {
  "429": {
    ...json("Error", "Za dużo zapytań: najwyżej 60 na minutę z jednego adresu IP."),
    headers: { "Retry-After": { description: "Po ilu sekundach spróbować ponownie.", schema: { type: "integer" } } },
  },
  "503": json("Error", "Baza danych jest niedostępna albo nie została skonfigurowana."),
};

function queryParameters() {
  return Object.entries(InnovationsQuery.shape).map(([name, schema]) => {
    const { description, ...rest } = tidy(z.toJSONSchema(schema, { io: "input" })) as Json;
    return { name, in: "query", required: false, description, schema: rest };
  });
}

const WEBHOOK_HEADERS = [
  { name: "X-Spolecznik-Event", in: "header", required: true, description: "Nazwa zdarzenia, jak pole event.", schema: { type: "string" } },
  {
    name: "X-Spolecznik-Signature",
    in: "header",
    required: true,
    description: "sha256=<HMAC-SHA256 surowej treści żądania, klucz: secret z webhook_endpoints, zapis szesnastkowy>.",
    schema: { type: "string", pattern: "^sha256=[0-9a-f]{64}$" },
  },
];

function webhook(id: string, summary: string, description: string) {
  return {
    post: {
      operationId: id.replace(/\.(\w)/g, (_, c: string) => c.toUpperCase()),
      summary,
      description,
      tags: ["Webhooki"],
      parameters: WEBHOOK_HEADERS,
      requestBody: { required: true, content: { "application/json": { schema: ref(id === "idea.created" ? "IdeaCreatedEvent" : "CallChangedEvent") } } },
      responses: { "200": { description: "Odbiorca przyjął zdarzenie. Kod spoza 2xx nie jest ponawiany." } },
    },
  };
}


export function buildOpenApi() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Społecznik — publiczne API",
      version: "1.0.0",
      summary: "Katalog innowacji społecznych Małopolski do odczytu i webhooki dla systemów Hubu.",
      description:
        "Publiczne API Społecznika (Małopolski Hub Innowacji Społecznych). Bez klucza i bez danych osobowych: " +
        "zwraca tylko opublikowane innowacje. Powiaty identyfikuje kod TERYT. " +
        `Limit: ${API_LIMIT_PER_MINUTE} zapytań na minutę z jednego adresu IP. Opis po polsku: /api-docs.`,
      contact: { name: "Dział Innowacji Społecznych ROPS w Krakowie", url: "https://rops.krakow.pl" },
    },
    servers: [{ url: "/", description: "Ta instancja Społecznika" }],
    security: [],
    tags: [
      { name: "Innowacje", description: "Katalog sprawdzonych innowacji społecznych (Biblioteka i wiedza)." },
      { name: "Specyfikacja", description: "Ten dokument." },
      { name: "Webhooki", description: "Zdarzenia, które baza wysyła na zarejestrowane adresy HTTPS." },
    ],
    paths: {
      "/api/v1/innowacje": {
        get: {
          operationId: "listInnovations",
          summary: "Lista innowacji",
          description: "Opublikowane innowacje, alfabetycznie, z filtrami. Odpowiedź może być do 5 minut w pamięci podręcznej.",
          tags: ["Innowacje"],
          parameters: queryParameters(),
          responses: {
            "200": json("InnovationList", "Strona listy innowacji."),
            "400": json("Error", "Nieprawidłowy parametr zapytania."),
            ...ERRORS,
          },
        },
      },
      "/api/v1/innowacje/{slug}": {
        get: {
          operationId: "getInnovation",
          summary: "Jedna innowacja",
          description: "Pełny opis innowacji i powiaty (TERYT), w których ją testowano.",
          tags: ["Innowacje"],
          parameters: [
            { name: "slug", in: "path", required: true, description: "Slug z pola slug albo id (UUID).", schema: { type: "string" } },
          ],
          responses: {
            "200": json("Innovation", "Innowacja."),
            "404": json("Error", "Nie ma takiej opublikowanej innowacji."),
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
      "idea.created": webhook("idea.created", "Nowy pomysł", "Ktoś zgłosił pomysł w Pracowni."),
      "call.activated": webhook("call.activated", "Nabór otwarty", "Administrator otworzył nabór (albo dodał otwarty)."),
      "call.deactivated": webhook("call.deactivated", "Nabór zamknięty", "Administrator zamknął nabór."),
    },
    components: { schemas: componentSchemas() },
  };
}

export type OpenApiDocument = ReturnType<typeof buildOpenApi>;
