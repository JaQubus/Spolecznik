import { EMPTY_GMINA, type GminaValue } from "@/components/gmina-field";
import { GMINA_OPTIONS } from "@/lib/gminy";
import { innovationOptions, pickInnovation } from "@/lib/innovations";
import { STATUS_CODE } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImplementationFlow } from "./implementation-flow";

export const metadata = { title: "Jak to wdrożyć u nas?" };

/** Gmina z wcześniejszego zgłoszenia (?potrzeba=SPL-…), żeby nie wpisywać jej drugi raz. */
async function gminaFromNeed(code: string): Promise<GminaValue> {
  const { data } = await createAdminClient().from("needs").select("teryt").eq("status_code", code).maybeSingle();
  const option = data?.teryt ? GMINA_OPTIONS.find((g) => g.teryt === data.teryt) : undefined;
  return option ? { text: option.nazwa, teryt: option.teryt } : EMPTY_GMINA;
}

export default async function Page(props: PageProps<"/wdrozenie">) {
  const params = await props.searchParams;
  const code = typeof params.potrzeba === "string" ? params.potrzeba.toUpperCase() : "";

  const [innovations, gmina] = await Promise.all([
    innovationOptions().catch(() => []),
    STATUS_CODE.test(code) ? gminaFromNeed(code).catch(() => EMPTY_GMINA) : Promise.resolve(EMPTY_GMINA),
  ]);

  const innovation = pickInnovation(params.innowacja, innovations);

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Jak to wdrożyć u nas?</h1>
        <p className="max-w-2xl text-lg">
          Wybierz rozwiązanie i swoją gminę. Przygotujemy kartę: kto skorzysta, jakie kroki, ile może kosztować
          i kto może pomóc. Wszystko, czego nie wiemy na pewno, oznaczymy jako założenie.
        </p>
      </div>
      <ImplementationFlow
        innovations={innovations}
        gminy={GMINA_OPTIONS}
        initialInnovation={innovation}
        initialGmina={gmina}
      />
    </section>
  );
}
