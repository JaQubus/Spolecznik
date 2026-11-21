import type { Metadata } from "next";
import { IntakeFlow } from "@/components/intake/intake-flow";
import { GMINA_OPTIONS } from "@/lib/gminy";

export const metadata: Metadata = { title: "Zgłoś inicjatywę" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function Page(props: PageProps<"/zglos">) {
  // ?opis=…&gmina=…&teryt=… przychodzą z wyszukiwarki na stronie startowej.
  const params = await props.searchParams;
  const teryt = first(params.teryt);
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Zgłoś inicjatywę</h1>
      <p className="max-w-2xl text-lg">
        Prowadzisz w szkole, na uczelni, w urzędzie albo instytucji coś, co działa i mogłoby zadziałać także gdzie indziej? Opisz to swoimi słowami — resztę uporządkujemy razem.
      </p>
      <IntakeFlow
        mode="own"
        path="/zglos"
        gminy={GMINA_OPTIONS}
        initialText={first(params.opis)}
        initialGmina={{ text: first(params.gmina), teryt: /^\d{7}$/.test(teryt) ? teryt : null }}
      />
    </section>
  );
}
