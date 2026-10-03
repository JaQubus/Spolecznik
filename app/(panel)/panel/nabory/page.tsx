import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/pl";
import { createAdminClient } from "@/lib/supabase/admin";
import { setCallActive } from "../actions";

export const metadata = { title: "Nabory · Panel ROPS" };

export default async function Page() {
  await requireAdmin();
  const { data, error } = await createAdminClient().from("calls").select("id, title, active, closes_at").order("closes_at");
  if (error) throw error;
  const calls = data ?? [];

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Nabory</h1>
      <p className="max-w-[68ch]">Po otwarciu naboru autorzy pasujących pomysłów dostaną powiadomienie.</p>
      {calls.length === 0 ? (
        <p className="text-muted-foreground">Nie ma jeszcze naborów.</p>
      ) : (
        <ul className="max-w-4xl divide-y border-y">
          {calls.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-bold">{c.title}</p>
                <p className="text-base text-muted-foreground">
                  {c.active ? "Otwarty" : "Zamknięty"}{c.closes_at && ` · wnioski do ${formatDate(c.closes_at)}`}
                </p>
              </div>
              <form action={setCallActive}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={String(!c.active)} />
                <Button type="submit" variant="outline" size="sm" aria-label={`${c.active ? "Zamknij" : "Otwórz"} nabór: ${c.title}`}>
                  {c.active ? "Zamknij nabór" : "Otwórz nabór"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
