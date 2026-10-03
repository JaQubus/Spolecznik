import { reindexCard } from "@/lib/index-card";
import { IndexCardRequest } from "@/lib/schemas";

/** Reindeks karty po zapisie w Panelu albo Pracowni (README 5.3). */
export async function POST(request: Request) {
  const parsed = IndexCardRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { kind, refId } = parsed.data;
  try {
    if (!(await reindexCard(kind, refId))) {
      return Response.json({ error: "Nie znaleziono karty" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[index-card]", e);
    return Response.json({ error: "Nie udało się zaktualizować indeksu" }, { status: 500 });
  }
}
