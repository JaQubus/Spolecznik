import { Alert } from "@/components/ui/alert";
import { FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/lib/auth";
import { panelTitle } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { institutionLabel } from "@/lib/taxonomy";
import { ActionForm, SubmitButton } from "../action-form";
import { assignKeeper, removeKeeper } from "../radar-actions";

export const metadata = { title: panelTitle("Instytucje") };

type InstitutionRow = { id: string; name: string; institution_type: string; email_domain: string | null; synthetic: boolean };
type Keeper = { id: string; institution_id: string; email: string | null };

/** Instytucje i ich opiekunowie. Opiekun widzi w Panelu tylko innowacje swojej instytucji (RLS po institution_id, 0010). */
export default async function Page() {
  await requireAdmin("/panel/instytucje");
  const supabase = createAdminClient();
  const [institutions, profiles] = await Promise.all([
    supabase.from("institutions").select("id, name, institution_type, email_domain, synthetic").order("name").limit(500),
    supabase.from("profiles").select("id, institution_id").eq("role", "institution").limit(500),
  ]);
  if (institutions.error) throw institutions.error;
  // Baza sprzed 0010 nie ma profiles.institution_id: lista instytucji działa, bez opiekunów.
  const missing = !!profiles.error;
  const keepers: Keeper[] = await Promise.all(
    ((profiles.data ?? []) as { id: string; institution_id: string }[]).map(async (p) => {
      const { data } = await supabase.auth.admin.getUserById(p.id);
      return { id: p.id, institution_id: p.institution_id, email: data.user?.email ?? null };
    }),
  );
  const byInstitution = Map.groupBy(keepers, (k) => k.institution_id);

  return (
    <section className="max-w-4xl space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Instytucje</h1>
        <p className="max-w-[68ch] text-lg">
          Opiekun instytucji to osoba, która widzi w Panelu tylko jej innowacje: listę, lejek i eksport CSV. Nie zmienia statusów ani publikacji.
          Konto musi się najpierw zalogować linkiem na e-mail.
        </p>
      </div>
      {missing && <Alert tone="warning" title="Brak kolumny opiekuna">Zastosuj migrację 0010_public_panel.sql, żeby przypisywać opiekunów.</Alert>}
      <ol className="border-t">
        {((institutions.data ?? []) as InstitutionRow[]).map((i) => (
          <li key={i.id} className="grid gap-3 border-b py-5">
            <h2 className="text-xl font-bold">{i.name}</h2>
            <p className="text-base text-muted-foreground">
              {institutionLabel(i.institution_type)}{i.email_domain && ` · domena: @${i.email_domain}`}{i.synthetic && " · dane syntetyczne"}
            </p>
            {(byInstitution.get(i.id) ?? []).map((k) => (
              <div key={k.id} className="flex flex-wrap items-center gap-3">
                <p>Opiekun: <strong>{k.email ?? "konto bez adresu"}</strong></p>
                <ActionForm action={removeKeeper}>
                  <input type="hidden" name="profileId" value={k.id} />
                  <SubmitButton variant="outline" size="sm" pendingText="Zdejmowanie…" aria-label={`Zdejmij dostęp opiekuna: ${k.email ?? i.name}`}>Zdejmij dostęp</SubmitButton>
                </ActionForm>
              </div>
            ))}
            {!missing && (
              <details className="max-w-xl">
                <summary className="inline-flex min-h-12 cursor-pointer items-center text-base underline decoration-1 underline-offset-4 hover:decoration-2">
                  Przypisz opiekuna<span className="sr-only">: {i.name}</span>
                </summary>
                <ActionForm action={assignKeeper} className="space-y-3 pt-2">
                  <input type="hidden" name="institutionId" value={i.id} />
                  <div className="space-y-2">
                    <Label htmlFor={`keeper-${i.id}`}>Adres e-mail konta</Label>
                    {i.email_domain && <FieldHint id={`keeper-${i.id}-pomoc`}>Adres musi być z domeny @{i.email_domain}.</FieldHint>}
                    <Input id={`keeper-${i.id}`} name="email" type="email" required autoComplete="off" aria-describedby={i.email_domain ? `keeper-${i.id}-pomoc` : undefined} className="max-w-xl" />
                  </div>
                  <SubmitButton variant="outline" size="sm" aria-label={`Przypisz opiekuna: ${i.name}`}>Przypisz</SubmitButton>
                </ActionForm>
              </details>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
