import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import { API_LIMIT_PER_MINUTE } from "@/lib/api/contract";
import { buildOpenApi } from "@/lib/api/openapi";
import { brand, region } from "@/lib/brand";

export const metadata: Metadata = {
  title: "API dla integracji",
  description: `Publiczne API serwisu ${brand.name}: opublikowane inicjatywy do odczytu, specyfikacja OpenAPI i webhooki.`,
};

const link = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";
// Zawijanie zamiast przewijania w bok: strona działa od 320 px (SC 1.4.10).
const code = "whitespace-pre-wrap break-words rounded-md bg-secondary p-4 font-mono text-base";

type Param = { name: string; in: string; required?: boolean; description?: string; schema?: { enum?: string[]; default?: unknown } };
type Operation = { operationId: string; summary: string; description: string; parameters?: Param[] };

/** Przykładowe wywołania; reszta strony powstaje ze specyfikacji, więc nie rozjedzie się z API. */
const EXAMPLES: Record<string, string> = {
  listInitiatives: "/api/v1/inicjatywy?dziedzina=edukacja&limit=5",
  getInitiative: "/api/v1/inicjatywy/<slug>",
  getOpenApi: "/api/v1/openapi.json",
};

const SAMPLE_EVENT = `{
  "event": "initiative.created",
  "occurredAt": "2026-10-04T10:15:00.123+00:00",
  "data": {
    "id": "5b0c8f2e-1d3a-4c6b-9e7f-2a1b3c4d5e6f",
    "createdAt": "2026-10-04T10:15:00.120+00:00",
    "submissionKind": "own",
    "domains": ["edukacja", "cyfryzacja"],
    "institutionType": "szkola_podstawowa",
    "stage": "pilotaz",
    "countyTeryt": "${region.countyExample.teryt}",
    "synthetic": false
  }
}`;

const REGISTER_SQL = `insert into webhook_endpoints (url, events, description)
values ('https://przyklad.pl/webhook', '{initiative.featured,program.activated}', 'System grantowy')
returning secret;`;

const VERIFY_JS = `import { createHmac, timingSafeEqual } from "node:crypto";

// rawBody: surowe bajty żądania, zanim zamienisz je na obiekt
const expected = "sha256=" + createHmac("sha256", SECRET).update(rawBody).digest("hex");
const received = request.headers["x-webhook-signature"] ?? "";
const ok = received.length === expected.length && timingSafeEqual(Buffer.from(received), Buffer.from(expected));`;

export default function Page() {
  const spec = buildOpenApi();
  const operations = Object.entries(spec.paths).map(([path, item]) => ({ path, op: item.get as Operation }));
  const webhooks = Object.entries(spec.webhooks).map(([event, item]) => ({ event, op: item.post as Operation }));

  return (
    <div className="max-w-[48rem] space-y-14">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold">API dla integracji</h1>
        <p className="text-xl">
          Opublikowane inicjatywy z serwisu {brand.name} są otwarte do odczytu dla gmin, instytucji i systemów zewnętrznych, np. bazy grantowej.
          Odpowiedzi są w JSON, a powiaty mają kody TERYT.
        </p>
        <p className="text-lg">
          <a href="/api/v1/openapi.json" className={`${link} inline-flex items-center gap-2`}>
            <ArrowDownTrayIcon aria-hidden className="size-5 shrink-0" />
            Specyfikacja OpenAPI 3.1 (JSON)
          </a>
        </p>
      </div>

      <section aria-labelledby="zasady" className="space-y-4">
        <h2 id="zasady" className="text-3xl font-bold">Zasady</h2>
        <ul className="list-disc space-y-2 pl-6 text-lg">
          <li>Bez klucza i bez logowania. API tylko czyta dane.</li>
          <li>Zwraca wyłącznie inicjatywy opublikowane po weryfikacji zespołu. Zgłoszenia przed weryfikacją i dane osobowe nie są dostępne.</li>
          <li>
            Najwyżej {API_LIMIT_PER_MINUTE} zapytań na minutę z jednego adresu IP. Po przekroczeniu dostaniesz kod 429 i
            nagłówek <code className="font-mono">Retry-After</code> z liczbą sekund.
          </li>
          <li>Odpowiedzi mogą być do 5 minut w pamięci podręcznej. Nowa inicjatywa pojawi się najpóźniej po tym czasie.</li>
          <li>Można wołać API z przeglądarki na innej domenie (CORS dla wszystkich).</li>
          <li>Dane demonstracyjne mają pole <code className="font-mono">synthetic: true</code>.</li>
        </ul>
      </section>

      <section aria-labelledby="endpointy" className="space-y-4">
        <h2 id="endpointy" className="text-3xl font-bold">Endpointy</h2>
        <ul className="divide-y border-y">
          {operations.map(({ path, op }) => (
            <li key={op.operationId} className="space-y-4 py-8">
              <h3 className="font-mono text-xl font-bold break-words">GET {path}</h3>
              <p className="text-lg">
                <span className="font-bold">{op.summary}.</span> {op.description}
              </p>
              {!!op.parameters?.length && (
                <dl className="space-y-3 text-lg">
                  {op.parameters.map((p) => (
                    <div key={p.name}>
                      <dt className="font-mono font-bold">
                        {p.name}
                        <span className="font-sans font-normal text-muted-foreground">
                          {p.in === "path" ? " (w adresie, wymagany)" : " (nieobowiązkowy)"}
                        </span>
                      </dt>
                      <dd>
                        {p.description}
                        {p.schema?.enum && <> Wartości: <span className="font-mono break-words">{p.schema.enum.join(", ")}</span>.</>}
                        {p.schema?.default !== undefined && <> Domyślnie {String(p.schema.default)}.</>}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <pre className={code}>{`curl "https://<adres-serwisu>${EXAMPLES[op.operationId]}"`}</pre>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="teryt" className="space-y-4">
        <h2 id="teryt" className="text-3xl font-bold">Kody TERYT</h2>
        <p className="text-lg">
          TERYT to wspólny klucz z innymi systemami. API posługuje się kodem powiatu: 4 cyfry, np.{" "}
          <code className="font-mono">{region.countyExample.teryt}</code> ({region.countyExample.name}) albo{" "}
          <code className="font-mono">{region.cityCountyExample.teryt}</code> ({region.cityCountyExample.name}). To pierwsze 4
          cyfry 7-cyfrowego kodu gminy, więc dane z innych systemów łatwo do niego sprowadzić.
        </p>
        <p className="text-lg">
          Filtr <code className="font-mono">teryt</code> działa na poziomie powiatu. Każda inicjatywa ma też pole{" "}
          <code className="font-mono">countyTeryt</code> i nazwę gminy, w której działa.
        </p>
      </section>

      <section aria-labelledby="webhooki" className="space-y-4">
        <h2 id="webhooki" className="text-3xl font-bold">Webhooki</h2>
        <p className="text-lg">
          Zamiast pytać API co chwilę, Twój system może dostawać zdarzenia. Baza wysyła wtedy żądanie POST z JSON na Twój adres
          HTTPS.
        </p>
        <ul className="divide-y border-y">
          {webhooks.map(({ event, op }) => (
            <li key={event} className="space-y-1 py-4 text-lg">
              <p className="font-mono font-bold">{event}</p>
              <p>
                <span className="font-bold">{op.summary}.</span> {op.description}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-lg">
          Nowe zgłoszenie przychodzi bez treści, bo do weryfikacji jest prywatne. Przykład:
        </p>
        <pre className={code}>{SAMPLE_EVENT}</pre>

        <h3 className="pt-4 text-2xl font-bold">Jak dodać adres</h3>
        <p className="text-lg">
          Na razie adres dodaje administrator {brand.nameGenitive} w bazie. W odpowiedzi dostaje klucz <code className="font-mono">secret</code>,
          który przekazuje Tobie.
        </p>
        <pre className={code}>{REGISTER_SQL}</pre>

        <h3 className="pt-4 text-2xl font-bold">Jak sprawdzić, że żądanie jest od nas</h3>
        <p className="text-lg">
          Nagłówek <code className="font-mono">X-Webhook-Signature</code> zawiera podpis HMAC-SHA256 treści żądania. Policz go
          z surowych bajtów, a nie z ponownie zapisanego JSON, i porównaj:
        </p>
        <pre className={code}>{VERIFY_JS}</pre>
        <p className="text-lg">
          Zdarzenie jest wysyłane raz. Jeśli Twój serwer nie odpowie kodem 2xx, nie ponawiamy go. Aktualny stan opublikowanych
          inicjatyw zawsze możesz pobrać z API. Programów API jeszcze nie udostępnia, więc pominiętego zdarzenia{" "}
          <code className="font-mono">program.*</code> nie da się odtworzyć.
        </p>
      </section>
    </div>
  );
}
