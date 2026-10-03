import { z } from "zod";
import { isAdmin } from "@/lib/auth";
import { knowledge } from "@/lib/knowledge";
import { canUseHybridSearch, indexEntity } from "@/lib/knowledge/indexing";

// README 5.3: przelicza lematy, tagi i embedding karty i robi upsert do search_index.
// Obsługuje karty Zasobnika wiedzy; karty matchmakingu indeksuje pipeline (data/embed.py) i /api/match.
const Body = z.object({ kind: z.string(), id: z.string().min(1) });

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Brak dostępu" }, { status: 403 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Podaj rodzaj karty i jej identyfikator" }, { status: 400 });
  if (!canUseHybridSearch()) {
    return Response.json({ indexed: false, reason: "Brak bazy lub klucza do embeddingów — wyszukiwanie działa po słowach." });
  }
  const { kind, id } = parsed.data;
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
    if (kind === "material") {
      const m = (await knowledge.materials({}, all)).find((x) => x.id === id);
      return m ? Response.json({ indexed: await indexEntity("material", m) }) : notFound();
    }
  } catch (e) {
    console.error("[index-card]", e);
    return Response.json({ error: "Nie udało się zaindeksować karty" }, { status: 500 });
  }
  return Response.json({ error: "Ten rodzaj karty indeksuje pipeline matchmakingu" }, { status: 501 });
}
