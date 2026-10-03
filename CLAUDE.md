@AGENTS.md

# Społecznik — notatki dla agentów

Plan projektu: README.md (po polsku). Kod i identyfikatory po angielsku, teksty UI po polsku.

- Next.js 16: `proxy.ts` zamiast `middleware.ts`; `params`/`searchParams` to Promise; `PageProps<'/trasa'>` i `RouteContext<'/trasa'>` są globalne.
- AI SDK 7: obiekty strukturalne przez `generateText({ output: Output.object({ schema }) })`. Modele w `lib/llm.ts`.
- Supabase: `lib/supabase/server.ts` (sesja + RLS), `client.ts` (przeglądarka), `admin.ts` (service_role, tylko serwer).
- Wymiar embeddingów (1536) musi się zgadzać w `lib/search.ts` i `supabase/migrations`.
- Wygląd: system projektowy w `docs/design-system/README.md` (tokeny, zasady, komponenty w `components/*.md`). Jeden zielony przycisk na widok, pola tekstowe jako białe pola z ramką, bez kart w wierszach.
- Ikony: Heroicons (`@heroicons/react/24/outline`), zawsze z klasą `size-*` i obok tekstu. shadcn generuje importy `lucide-react` — po `shadcn add` podmień je na Heroicons.
- Dostępność to wymóg, nie dodatek: etykiety przy polach, `aria-live` dla wyników asynchronicznych, ikony zawsze z tekstem.
- Pipeline danych: `cd data && uv run <skrypt>.py`.
