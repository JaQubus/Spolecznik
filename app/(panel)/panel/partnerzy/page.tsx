import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { panelTitle } from "@/lib/brand";
import { formatDate } from "@/lib/pl";
import { createAdminClient } from "@/lib/supabase/admin";
import { partnerKindLabel, partnerSupportLabel, sectorLabel } from "@/lib/taxonomy";
import { ActionForm, SubmitButton } from "../action-form";
import { setPartnerActive } from "../radar-actions";

export const metadata = { title: panelTitle("Partnerzy") };

type PartnerRow = {
  id: string; name: string; kind: string; description: string; sectors: string[]; support: string[]; trl_min: number | null; trl_max: number | null;
  active: boolean; synthetic: boolean; created_at: string;
};

/** Partnerzy: profile z formularza „Szukam innowacji” czekają na zatwierdzenie, dopiero potem trafiają do dopasowań. */
export default async function Page() {
  await requireAdmin("/panel/partnerzy");
  const [partners, alerts] = await Promise.all([
    createAdminClient().from("partners")
      .select("id, name, kind, description, sectors, support, trl_min, trl_max, active, synthetic, created_at")
      .order("active").order("created_at", { ascending: false }).limit(500),
    createAdminClient().from("innovation_alerts").select("partner_id").eq("active", true).limit(5000),
  ]);
  if (partners.error) throw partners.error;
  const alertCount = new Map<string, number>();
  // Baza sprzed 0010 nie ma innovation_alerts: lista partnerów działa bez liczby alertów.
  for (const a of alerts.data ?? []) if (a.partner_id) alertCount.set(a.partner_id as string, (alertCount.get(a.partner_id as string) ?? 0) + 1);
  const rows = (partners.data ?? []) as PartnerRow[];
  const pending = rows.filter((r) => !r.active && !r.synthetic);

  return (
    <section className="max-w-4xl space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Partnerzy</h1>
        <p className="max-w-[68ch] text-lg">
          Firmy, fundusze, centra transferu technologii i samorządy, które szukają innowacji. Zatwierdź profil z formularza „Szukam innowacji”,
          żeby partner pojawił się w dopasowaniach. Kontakt z twórcą nadal wymaga zgody obu stron.
        </p>
      </div>
      {pending.length > 0 && <Alert tone="warning" title={`Czeka na zatwierdzenie: ${pending.length}`} />}
      <ol className="border-t">
        {rows.map((p) => (
          <li key={p.id} className="grid gap-2 border-b py-5">
            <h2 className="text-xl font-bold">{p.name}</h2>
            <p className="text-base text-muted-foreground">
              {partnerKindLabel(p.kind)} · zgłoszony {formatDate(p.created_at)}
              {(p.trl_min != null || p.trl_max != null) && ` · TRL ${p.trl_min ?? 1}–${p.trl_max ?? 9}`}
              {alertCount.get(p.id) ? ` · alerty e-mail: ${alertCount.get(p.id)}` : ""}
            </p>
            <p className="max-w-[68ch]">{p.description}</p>
            <ul className="flex flex-wrap gap-2" aria-label="Sektory i formy wsparcia">
              {p.sectors.map((s) => <li key={s}><Badge>{sectorLabel(s)}</Badge></li>)}
              {p.support.map((s) => <li key={s}><Badge variant="outline">{partnerSupportLabel(s)}</Badge></li>)}
              {!p.active && <li><Badge variant="warning">Nieaktywny</Badge></li>}
              {p.synthetic && <li><Badge variant="outline">Dane syntetyczne</Badge></li>}
            </ul>
            <ActionForm action={setPartnerActive}>
              <input type="hidden" name="partnerId" value={p.id} />
              <input type="hidden" name="active" value={p.active ? "false" : "true"} />
              <SubmitButton variant="outline" size="sm" aria-label={`${p.active ? "Wyłącz" : "Zatwierdź"}: ${p.name}`}>{p.active ? "Wyłącz z dopasowania" : "Zatwierdź"}</SubmitButton>
            </ActionForm>
          </li>
        ))}
      </ol>
    </section>
  );
}
