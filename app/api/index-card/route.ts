import { z } from "zod";
import { isAdmin } from "@/lib/auth";
import { aiErrorResponse } from "@/lib/groq";
import { reindexCard } from "@/lib/index-card";
import { knowledge } from "@/lib/knowledge";
import { indexEntity } from "@/lib/knowledge/indexing";
import { rateLimit } from "@/lib/rate-limit";
import { IndexCardRequest } from "@/lib/schemas";

// Karty bazy wiedzy (Panel → Wiedza): { kind: "rozwiazanie" | "dziedzina" | "material", id }.
const KnowledgeCard = z.object({ kind: z.enum(["rozwiazanie", "dziedzina", "material"]), id: z.string().min(1) });

/**
 * Reindeks karty po zapisie — tylko admin, bo każde wywołanie kosztuje zapytanie do LLM. Karty dopasowań
 * (inicjatywa, rozwiązanie, mentor, program) liczy lib/index-card.ts; karty bazy wiedzy — lib/knowledge/indexing.ts.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "index-card", 20);
  if (limited) return limited;
  if (!(await isAdmin())) return Response.json({ error: "Brak dostępu" }, { status: 403 });
  const body = await request.json().catch(() => null);

  const card = KnowledgeCard.safeParse(body);
  if (card.success) return indexKnowledgeCard(card.data);

  const parsed = IndexCardRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Podaj rodzaj karty i jej identyfikator", issues: parsed.error.issues }, { status: 400 });
  }
  const { kind, refId } = parsed.data;
  try {
    if (!(await reindexCard(kind, refId))) {
      return Response.json({ error: "Nie znaleziono karty" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return aiErrorResponse("index-card", e, "Nie udało się zaktualizować indeksu");
  }
}

async function indexKnowledgeCard({ kind, id }: z.infer<typeof KnowledgeCard>): Promise<Response> {
  const all = { all: true };
  const notFound = () => Response.json({ error: "Nie ma takiej karty" }, { status: 404 });
  try {
    if (kind === "rozwiazanie") {
      const p = await knowledge.pattern(id, all);
      return p ? Response.json({ indexed: await indexEntity("rozwiazanie", p) }) : notFound();
    }
    if (kind === "dziedzina") {
      const d = await knowledge.domain(id, all);
      return d ? Response.json({ indexed: await indexEntity("dziedzina", d) }) : notFound();
    }
    const m = (await knowledge.materials({}, all)).find((x) => x.id === id);
    return m ? Response.json({ indexed: await indexEntity("material", m) }) : notFound();
  } catch (e) {
    return aiErrorResponse("index-card", e, "Nie udało się zaindeksować karty");
  }
}
