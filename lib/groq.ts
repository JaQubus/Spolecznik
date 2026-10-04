import "server-only";
import { z } from "zod";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatOptions = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean; // tryb JSON: odpowiedź to zawsze poprawny obiekt JSON
};

/** Groq odrzuca zapytania z powodu limitu na minutę (429) mimo ponowień. */
export class GroqBusyError extends Error {
  constructor(detail: string) {
    super(`Groq 429: ${detail}`);
    this.name = "GroqBusyError";
  }
}

/**
 * Odpowiedź trasy API na błąd: limit Groq → 503 z komunikatem, co zrobić; inne błędy → 500 z `message`.
 */
export function aiErrorResponse(tag: string, e: unknown, message: string): Response {
  console.error(`[${tag}]`, e);
  if (e instanceof GroqBusyError) {
    return Response.json({ error: "Za dużo zapytań do AI naraz. Spróbuj ponownie za minutę" }, { status: 503 });
  }
  return Response.json({ error: message }, { status: 500 });
}

/** Ile łącznie czekamy na limit Groq w jednym wywołaniu, zanim oddamy 503. */
const RATE_LIMIT_BUDGET_MS = 20_000;

/** Jedno wywołanie Groq (API zgodne z OpenAI). Klucz tylko po stronie serwera. */
export async function groqChat({ model, messages, temperature = 0.5, maxTokens = 4096, json }: ChatOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Brak GROQ_API_KEY w .env.local");

  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens, // obejmuje też tokeny rozumowania
        ...(json && { response_format: { type: "json_object" } }),
        // gpt-oss to modele rozumujące: krótkie rozumowanie i bez jego treści w odpowiedzi.
        ...(model.startsWith("openai/gpt-oss") && { reasoning_effort: "low", include_reasoning: false }),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    // Darmowy plan ma 8 tys. tokenów na minutę, a pełne dopasowanie zużywa ok. 6 tys. — czekamy tyle, ile każe
    // Groq, ale łącznie najwyżej RATE_LIMIT_BUDGET_MS na wywołanie. Dłuższe czekanie zgłaszamy od razu jako 503
    // („Spróbuj ponownie za minutę”), zamiast trzymać użytkownika minutami przy „Szukam rozwiązań…”.
    if (response.status === 429) {
      const wait = (Number(response.headers.get("retry-after")) || 5) * 1000;
      if (attempt >= 2 || waited + wait > RATE_LIMIT_BUDGET_MS) throw new GroqBusyError(await response.text());
      waited += wait;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!response.ok) throw new Error(`Groq ${response.status}: ${await response.text()}`);

    const data = await response.json();
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error(`Groq: odpowiedź ucięta po ${maxTokens} tokenach`);
    const content = choice?.message?.content;
    if (typeof content !== "string" || !content) throw new Error("Groq zwrócił pustą odpowiedź");
    return content;
  }
}

type ObjectOptions = { model: string; system: string; prompt: string; temperature?: number };

/**
 * Obiekt strukturalny: tryb JSON + JSON Schema w prompcie + walidacja zod.
 * Tryb JSON nie gwarantuje zgodności ze schematem, więc przy błędzie raz prosimy model o poprawkę.
 */
export async function groqObject<T extends z.ZodType>(
  schema: T,
  { model, system, prompt, temperature }: ObjectOptions,
): Promise<z.output<T>> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${system}

Odpowiadasz wyłącznie jednym obiektem JSON zgodnym z tym JSON Schema (klucze i wartości wyliczeniowe dokładnie jak w schemacie):
${JSON.stringify(z.toJSONSchema(schema))}`,
    },
    { role: "user", content: prompt },
  ];

  for (let attempt = 0; ; attempt++) {
    const raw = await groqChat({ model, messages, temperature, json: true });
    let problem: string;
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      problem = z.prettifyError(parsed.error);
    } catch {
      problem = "to nie jest poprawny JSON";
    }
    if (attempt >= 1) throw new Error(`Groq: odpowiedź niezgodna ze schematem (${problem})`);
    messages.push(
      { role: "assistant", content: raw },
      { role: "user", content: `Odpowiedź nie pasuje do schematu: ${problem}\nZwróć poprawiony obiekt JSON.` },
    );
  }
}
