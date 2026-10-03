import { rerank, type Candidate } from "@/lib/llm";
import { GAP_THRESHOLD, MatchRequest } from "@/lib/schemas";
import { embedText, hybridSearch } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const parsed = MatchRequest.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Nieprawidłowe dane", issues: parsed.error.issues }, { status: 400 });
  }
  const { card, teryt } = parsed.data;
  const supabase = createAdminClient();
  const embedding = await embedText(card.summary);

  // Osobne wyszukiwanie dla każdego typu karty.
  const [innovations, similarNeeds, experts, calls] = await Promise.all([
    hybridSearch("innowacja", card.keywords, embedding, 15),
    hybridSearch("potrzeba", card.keywords, embedding, 5),
    hybridSearch("ekspert", card.keywords, embedding, 3),
    hybridSearch("nabor", card.keywords, embedding, 3),
  ]);

  const { data: rows } = await supabase
    .from("search_index")
    .select("ref_id, title, body")
    .eq("kind", "innowacja")
    .in("ref_id", innovations.map((h) => h.ref_id));
  const candidates: Candidate[] = (rows ?? []).map((r) => ({ id: r.ref_id, title: r.title, body: r.body }));

  let gminaProfile: string | undefined;
  if (teryt) {
    const { data: g } = await supabase.from("gminy").select("*").eq("teryt", teryt).maybeSingle();
    if (g) gminaProfile = JSON.stringify(g);
  }

  const matches = await rerank(card, candidates, gminaProfile);
  const isGap = (matches[0]?.fit ?? 0) < GAP_THRESHOLD;

  return Response.json({ matches, isGap, similarNeeds, experts, calls });
}
