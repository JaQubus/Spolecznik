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

/** Jedno wywołanie Groq (API zgodne z OpenAI). Klucz tylko po stronie serwera. */
export async function groqChat({ model, messages, temperature = 0.2, maxTokens, json }: ChatOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Brak GROQ_API_KEY w .env.local");

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
      ...(maxTokens && { max_tokens: maxTokens }),
      ...(json && { response_format: { type: "json_object" } }),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Groq ${response.status}: ${await response.text()}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Groq zwrócił pustą odpowiedź");
  return content;
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
