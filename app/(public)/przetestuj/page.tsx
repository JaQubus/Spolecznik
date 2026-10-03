import { createAdminClient } from "@/lib/supabase/admin";
import { TestForm } from "./test-form";

export const metadata = { title: "Przetestuj rozwiązanie" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function options(): Promise<{ id: string; title: string; slug: string | null }[]> {
  const { data, error } = await createAdminClient().from("innovations").select("id, title, slug").order("title");
  if (error) throw error;
  return data ?? [];
}

export default async function Page(props: PageProps<"/przetestuj">) {
  const params = await props.searchParams;
  const innovation = typeof params.innowacja === "string" && UUID.test(params.innowacja) ? params.innowacja : "";
  const innovations = await options().catch(() => []);

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Przetestuj rozwiązanie</h1>
        <p className="max-w-2xl text-lg">
          Zgłoś, że chcesz sprawdzić rozwiązanie u siebie, a po teście oceń, jak poszło. Oceny widzą inne gminy,
          więc łatwiej im zdecydować, czy warto spróbować.
        </p>
      </div>
      <TestForm innovations={innovations} initialInnovation={innovation} />
    </section>
  );
}
