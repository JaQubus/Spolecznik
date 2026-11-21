import "server-only";
import { sendEmail } from "../email";
import { createAdminClient } from "../supabase/admin";
import { brand, org } from "../brand";
import { sectorLabel, innovationKindLabel } from "../taxonomy";
import { alertMatches } from "./alerts";

const MAX_PER_RUN = 200;

const absolute = (path: string) => {
  const site = process.env.SITE_URL?.replace(/\/$/, "");
  return site ? `${site}${path}` : path;
};

/**
 * Alerty o nowej, opublikowanej innowacji: wysyła e-mail każdemu aktywnemu odbiorcy, którego profil pasuje
 * (sektor, typ, zakres TRL), i zapisuje to w innovation_alert_deliveries — ta sama innowacja nie dojdzie dwa razy.
 * Wołane po publikacji w Panelu. Zwraca liczbę wysłanych wiadomości; błąd pojedynczej wiadomości nie przerywa reszty.
 */
export async function sendAlertsFor(initiativeId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("initiatives")
    .select("id, slug, title, summary, innovation_kind, sectors, trl, published, status, duplicate_of")
    .eq("id", initiativeId)
    .maybeSingle();
  if (error) throw error;
  if (!row || !row.published || row.duplicate_of || row.status === "archived" || row.status === "detected") return 0;

  const [{ data: alerts, error: alertsError }, { data: sent, error: sentError }] = await Promise.all([
    supabase.from("innovation_alerts").select("id, email, sectors, kinds, trl_min, trl_max, token, synthetic").eq("active", true).limit(5000),
    supabase.from("innovation_alert_deliveries").select("alert_id").eq("initiative_id", initiativeId),
  ]);
  if (alertsError) throw alertsError;
  if (sentError) throw sentError;
  const done = new Set((sent ?? []).map((d) => d.alert_id as string));

  const target = { sectors: (row.sectors as string[]) ?? [], innovation_kind: row.innovation_kind as string | null, trl: row.trl as number | null };
  const due = (alerts ?? [])
    .filter((a) => !a.synthetic && !done.has(a.id as string))
    .filter((a) => alertMatches({ sectors: a.sectors as string[], kinds: a.kinds as string[], trlMin: a.trl_min as number | null, trlMax: a.trl_max as number | null }, target))
    .slice(0, MAX_PER_RUN);

  const page = absolute(`/innowacje/${encodeURIComponent((row.slug as string | null) ?? (row.id as string))}`);
  const facts = [
    row.innovation_kind && `Typ: ${innovationKindLabel(row.innovation_kind as string)}`,
    target.sectors.length > 0 && `Sektory: ${target.sectors.map(sectorLabel).join(", ")}`,
    target.trl != null && `TRL ${target.trl}`,
  ].filter(Boolean).join(" · ");

  let count = 0;
  for (const a of due) {
    const ok = await sendEmail({
      to: a.email as string,
      subject: `Nowa innowacja w ${brand.name}: ${row.title}`,
      text: [
        `W ${brand.name} pojawiła się innowacja, która pasuje do Twojego profilu.`,
        "",
        row.title as string,
        row.summary as string,
        facts,
        "",
        `Zobacz kartę: ${page}`,
        `Kontakt z twórcą zestawia zespół ${org.short}, gdy zgodzą się obie strony.`,
        "",
        `Nie chcesz dostawać takich wiadomości? Wypisz się: ${absolute(`/alerty/${a.token as string}`)}`,
      ].filter((l) => l !== "").join("\n"),
    }).catch((e) => { console.error("[alerty] wysyłka:", e); return false; });
    if (!ok) continue;
    const { error: insertError } = await supabase.from("innovation_alert_deliveries").insert({ alert_id: a.id, initiative_id: initiativeId });
    if (insertError) console.error("[alerty] zapis wysyłki:", insertError);
    count += 1;
  }
  return count;
}
