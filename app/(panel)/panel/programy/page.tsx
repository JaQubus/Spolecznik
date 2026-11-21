import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/pl";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeleteForm } from "../action-form";
import { setProgramActive } from "../actions";
import { panelTitle } from "@/lib/brand";

export const metadata = { title: panelTitle("Programy") };

export default async function Page(props: PageProps<"/panel/programy">) {
  await requireAdmin();
  const { usunieto } = await props.searchParams;
  const { data, error } = await createAdminClient().from("programs").select("id, title, active, closes_at, synthetic").order("closes_at");
  if (error) throw error;
  const programs = data ?? [];

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Programy</h1>
      {usunieto === "program" && <Alert tone="success" title="Usunięto program" />}
      <p className="max-w-[68ch]">Po otwarciu programu autorzy pasujących inicjatyw dostaną powiadomienie.</p>
      {programs.length === 0 ? (
        <p className="text-muted-foreground">Nie ma jeszcze programów.</p>
      ) : (
        <ul className="max-w-4xl divide-y border-y">
          {programs.map((c) => (
            <li key={c.id} className="grid gap-2 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{c.title}{c.synthetic && " (przykład)"}</p>
                  <p className="text-base text-muted-foreground">
                    {c.active ? "Otwarty" : "Zamknięty"}{c.closes_at && ` · wnioski do ${formatDate(c.closes_at)}`}
                  </p>
                </div>
                <form action={setProgramActive}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={String(!c.active)} />
                  <Button type="submit" variant="outline" size="sm" aria-label={`${c.active ? "Zamknij" : "Otwórz"} program: ${c.title}`}>
                    {c.active ? "Zamknij program" : "Otwórz program"}
                  </Button>
                </form>
              </div>
              <DeleteForm
                entity="program"
                id={c.id}
                label={`program: ${c.title}`}
                consequence="Znikną też wszystkie szkice wniosków do tego programu. Jeśli chcesz tylko wstrzymać wnioski, zamknij program."
                collapsed
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
