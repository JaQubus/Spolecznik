import type { Metadata } from "next";
import { IntakeFlow } from "@/components/intake/intake-flow";
import { GMINA_OPTIONS } from "@/lib/gminy";
import { institutionOptions } from "@/lib/innovations/public-institutions";

export const metadata: Metadata = { title: "Wskaż inicjatywę" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function Page(props: PageProps<"/wskaz">) {
  // ?opis=…&gmina=…&teryt=… przychodzą z wyszukiwarki na stronie startowej.
  const params = await props.searchParams;
  const teryt = first(params.teryt);
  const institutions = await institutionOptions();
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Wskaż inicjatywę</h1>
      <p className="max-w-2xl text-lg">
        Widzisz w swojej okolicy inicjatywę, o której powinno być głośniej? Wskaż ją. Nie musisz jej prowadzić ani znać wszystkich szczegółów.
      </p>
      <IntakeFlow
        mode="nomination"
        path="/wskaz"
        gminy={GMINA_OPTIONS}
        institutions={institutions}
        initialText={first(params.opis)}
        initialGmina={{ text: first(params.gmina), teryt: /^\d{7}$/.test(teryt) ? teryt : null }}
      />
    </section>
  );
}
