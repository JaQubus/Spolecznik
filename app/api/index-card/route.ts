import { z } from "zod";
import { isAdmin } from "@/lib/auth";
import { reindexCard } from "@/lib/index-card";
import { knowledge } from "@/lib/knowledge";
import { canUseHybridSearch, indexEntity } from "@/lib/knowledge/indexing";
import { rateLimit } from "@/lib/rate-limit";
import { aiErrorResponse } from "@/lib/groq";
import { IndexCardRequest } from "@/lib/schemas";

// Karty Zasobnika wiedzy (panel „Zarządzaj wiedzą”): { kind: "biblioteka" | "obszar" | "material", id }.
const KnowledgeCard = z.object({ kind: z.enum(["biblioteka", "obszar", "material"]), id: z.string().min(1) });

/**
 * Reindeks karty po zapisie (README 5.3). Karty matchmakingu (potrzeba, pomysł, innowacja, ekspert, nabór)
 * liczy lib/index-card.ts; karty Zasobnika — lib/knowledge/indexing.ts (tylko admin).
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "index-card", 20);
  if (limited) return limited;
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
  if (!(await isAdmin())) return Response.json({ error: "Brak dostępu" }, { status: 403 });
  if (!canUseHybridSearch()) {
    return Response.json({ indexed: false, reason: "Wyszukiwarka Zasobnika działa po słowach w danych — indeks nie jest potrzebny." });
  }
  const all = { all: true };
  const notFound = () => Response.json({ error: "Nie ma takiej karty" }, { status: 404 });
  try {
    if (kind === "biblioteka") {
      const i = await knowledge.innovation(id, all);
      return i ? Response.json({ indexed: await indexEntity("innowacja", i) }) : notFound();
    }
    if (kind === "obszar") {
      const a = await knowledge.area(id, all);
      return a ? Response.json({ indexed: await indexEntity("obszar", a) }) : notFound();
    }
    const m = (await knowledge.materials({}, all)).find((x) => x.id === id);
    return m ? Response.json({ indexed: await indexEntity("material", m) }) : notFound();
  } catch (e) {
    return aiErrorResponse("index-card", e, "Nie udało się zaindeksować karty");
  }
}
