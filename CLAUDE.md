@AGENTS.md

# Społecznik — notatki dla agentów

Plan projektu: README.md (po polsku). Kod i identyfikatory po angielsku, teksty UI po polsku.

- Next.js 16: `proxy.ts` zamiast `middleware.ts`; `params`/`searchParams` to Promise; `PageProps<'/trasa'>` i `RouteContext<'/trasa'>` są globalne.
- LLM: Groq przez `fetch` w `lib/groq.ts`; obiekty strukturalne przez `groqObject(schema, …)` (tryb JSON + walidacja zod). Modele i prompty w `lib/llm.ts`. AI SDK (`@ai-sdk/openai`) tylko do embeddingów.
- Supabase: `lib/supabase/server.ts` (sesja + RLS), `client.ts` (przeglądarka), `admin.ts` (service_role, tylko serwer).
- Wymiar embeddingów (1536) musi się zgadzać w `lib/search.ts` i `supabase/migrations`.
- Wygląd: system projektowy w `docs/design-system/README.md` (tokeny, zasady, komponenty w `components/*.md`). Jeden zielony przycisk na widok, pola tekstowe jako białe pola z ramką, bez kart w wierszach.
- Dostępność to wymóg, nie dodatek: etykiety przy polach, `aria-live` dla wyników asynchronicznych, ikony zawsze z tekstem.
- Pipeline danych: `cd data && uv run <skrypt>.py`.
