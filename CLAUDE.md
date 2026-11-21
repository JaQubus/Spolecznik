@AGENTS.md

# Radar Innowacji — notatki dla agentów

Plan projektu: README.md (po polsku). Kod i identyfikatory po angielsku, teksty UI po polsku.

- Next.js 16: `proxy.ts` zamiast `middleware.ts`; `params`/`searchParams` to Promise; `PageProps<'/trasa'>` i `RouteContext<'/trasa'>` są globalne.
- LLM: Groq przez `fetch` w `lib/groq.ts`; obiekty strukturalne przez `groqObject(schema, …)` (tryb JSON + walidacja zod). Modele i prompty w `lib/llm.ts`. Tylko Groq — bez innych dostawców AI.
- Supabase: `lib/supabase/server.ts` (sesja + RLS), `client.ts` (przeglądarka), `admin.ts` (service_role, tylko serwer).
- Bez embeddingów (Groq ich nie ma): wyszukiwanie po lematach z LLM — `keyword_search` w `supabase/migrations/0002_search.sql`, wywołania w `lib/search.ts`.
- Wygląd: system projektowy w `docs/design-system/README.md` (tokeny, zasady, komponenty w `components/*.md`). Jeden zielony przycisk na widok, pola tekstowe jako białe pola z ramką, bez kart w wierszach.
- Ikony: Heroicons (`@heroicons/react/24/outline`), zawsze z klasą `size-*` i obok tekstu. shadcn generuje importy `lucide-react` — po `shadcn add` podmień je na Heroicons.
- Dostępność to wymóg, nie dodatek: etykiety przy polach, `aria-live` dla wyników asynchronicznych, ikony zawsze z tekstem.
- Pipeline danych: `cd data && uv run <skrypt>.py`.
- Ścieżki rozwoju i dopasowanie partnerów: reguły, mierniki, wagi i lejek w `config/taxonomy.json` (`pathways`, `pathwayRules`, `easeOfAdoption`, `partnerMatching`, `funnel`), czyste funkcje w `lib/pathways/` (`rules.ts`, `match.ts`, `view.ts`), LLM pisze tylko uzasadnienie. Kontakt z partnerem za zgodą obu stron: `lib/contacts.ts`, lejek: `advance_funnel()` (`lib/funnel.ts`).
- Marka i region tylko z `config/brand.json`: w aplikacji przez `lib/brand.ts` (`brand`, `org`, `region`, `STATUS_CODE`, `panelTitle`), w Pythonie przez `data/region.py`. Nie wpisuj na sztywno nazwy serwisu, organizacji, regionu, prefiksu kodu zgłoszenia ani kodów TERYT. Moduły testowane czystym Node (`tests/unit`) importują `./brand.ts` względnie, bez aliasu `@/`.
- Strony publiczne i Panel (8/10, 9/10): `/innowacje` (filtry w `lib/innovations/filters.ts`, mapa powiatów), `/instytucje/[slug]`, `/szukam-innowacji` (profil partnera + alerty e-mail, `lib/innovations/alerts*.ts`). Panel: `/panel/lejek`, `/wskazniki`, `/partnerzy`, `/instytucje`, eksport `/panel/eksport`. Zakres dostępu: `requireStaff()` (`lib/panel/access.ts`); opiekun instytucji (rola `institution`) widzi tylko swoją instytucję (RLS po `institution_id`, migracja `0010`). Akcje zmieniające dane: `requireAdmin()`. Pliki `"use server"` eksportują tylko akcje wywoływalne z UI — funkcji pomocniczych (np. wysyłka alertów) nie eksportuj stamtąd.
