import "server-only";
import { emailAuthor } from "./author-contact";
import type { Innovation } from "./knowledge/types";
import { notify } from "./notifications";
import { createAdminClient } from "./supabase/admin";

/**
 * Nowa innowacja w Bibliotece → autorzy otwartych potrzeb z tego samego obszaru Mapy Wyzwań (README §6,
 * powiadomienia proaktywne, #65). Dzwonek dla autorów z kontem, e-mail dla tych, którzy zostawili adres.
 * Wołane raz, przy pierwszej publikacji — nie przy każdej poprawce opisu.
 */
export async function alertNeedsAboutInnovation(i: Innovation): Promise<void> {
  if (!i.areas.length) return;
  const { data, error } = await createAdminClient()
    .from("needs")
    .select("id, status_code, card, author_id, contact_email")
    .neq("status", "zamkniete")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  const matching = (data ?? []).filter((n) => {
    const areas = ((n.card as { areas?: string[] } | null)?.areas ?? []) as string[];
    return areas.some((a) => (i.areas as string[]).includes(a));
  });
  const payload = (n: (typeof matching)[number]) => ({ needId: n.id, code: n.status_code, slug: i.slug, title: i.title });
  const withAccount = matching.filter((n) => n.author_id);
  if (withAccount.length) {
    await notify(withAccount.map((n) => ({ user_id: n.author_id as string, kind: "nowa_innowacja", payload: payload(n) })))
      .catch((e) => console.error("[powiadomienia] nowa innowacja:", e));
  }
  for (const n of matching.filter((x) => x.contact_email)) {
    await emailAuthor("potrzeba", n.id as string, `W Bibliotece pojawiło się rozwiązanie, które może pasować: „${i.title}”`);
  }
  console.info(`[powiadomienia] innowacja ${i.slug}: ${matching.length} pasujących potrzeb (${withAccount.length} z kontem)`);
}

