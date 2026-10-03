import { innovationOptions } from "@/lib/library";
import { STATUS_CODE } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImplementationFlow } from "./implementation-flow";

export const metadata = { title: "Jak to wdrożyć u nas?" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Gmina z wcześniejszego zgłoszenia (?potrzeba=SPL-…), żeby nie wpisywać jej drugi raz. */
async function gminaFromNeed(code: string): Promise<string> {
  const { data } = await createAdminClient().from("needs").select("gminy(nazwa)").eq("status_code", code).maybeSingle();
  return (data?.gminy as unknown as { nazwa: string } | null)?.nazwa ?? "";
}

export default async function Page(props: PageProps<"/wdrozenie">) {
  const params = await props.searchParams;
  const innovation = typeof params.innowacja === "string" && UUID.test(params.innowacja) ? params.innowacja : "";
  const code = typeof params.potrzeba === "string" ? params.potrzeba.toUpperCase() : "";

  const [innovations, gmina] = await Promise.all([
    innovationOptions().catch(() => []),
    STATUS_CODE.test(code) ? gminaFromNeed(code).catch(() => "") : Promise.resolve(""),
  ]);

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Jak to wdrożyć u nas?</h1>
        <p className="max-w-2xl text-lg">
          Wybierz rozwiązanie i swoją gminę. Przygotujemy kartę: kto skorzysta, jakie kroki, ile może kosztować
          i kto może pomóc. Wszystko, czego nie wiemy na pewno, oznaczymy jako założenie.
        </p>
      </div>
      <ImplementationFlow innovations={innovations} initialInnovation={innovation} initialGmina={gmina} />
    </section>
  );
}
