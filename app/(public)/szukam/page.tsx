import type { Metadata } from "next";
import { IntakeFlow } from "@/components/intake/intake-flow";
import { GMINA_OPTIONS } from "@/lib/gminy";

export const metadata: Metadata = { title: "Szukam rozwiązania" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function Page(props: PageProps<"/szukam">) {
  // ?opis=…&gmina=…&teryt=… przychodzą z wyszukiwarki na stronie startowej.
  const params = await props.searchParams;
  const teryt = first(params.teryt);
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Szukam rozwiązania</h1>
      <p className="max-w-2xl text-lg">
        Opisz problem, z którym mierzy się Twoja szkoła, uczelnia, urząd albo firma. Pokażemy innowacje z regionu, które już na niego odpowiadają.
      </p>
      <IntakeFlow
        mode="challenge"
        path="/szukam"
        gminy={GMINA_OPTIONS}
        initialText={first(params.opis)}
        initialGmina={{ text: first(params.gmina), teryt: /^\d{7}$/.test(teryt) ? teryt : null }}
      />
    </section>
  );
}
