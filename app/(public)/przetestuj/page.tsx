import { GMINA_OPTIONS } from "@/lib/gminy";
import { pickInnovation } from "@/lib/innovations";
import { createAdminClient } from "@/lib/supabase/admin";
import { TestForm } from "./test-form";

export const metadata = { title: "Przetestuj rozwiązanie" };

async function options(): Promise<{ id: string; title: string; slug: string | null }[]> {
  const { data, error } = await createAdminClient().from("innovations").select("id, title, slug").order("title");
  if (error) throw error;
  return data ?? [];
}

export default async function Page(props: PageProps<"/przetestuj">) {
  const params = await props.searchParams;
  const innovations = await options().catch(() => []);
  const innovation = pickInnovation(params.innowacja, innovations);

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Przetestuj rozwiązanie</h1>
        <p className="max-w-2xl text-lg">
          Zgłoś, że chcesz sprawdzić rozwiązanie u siebie, a po teście oceń, jak poszło. Oceny widzą inne gminy,
          więc łatwiej im zdecydować, czy warto spróbować.
        </p>
      </div>
      <TestForm innovations={innovations} gminy={GMINA_OPTIONS} initialInnovation={innovation} />
    </section>
  );
}
