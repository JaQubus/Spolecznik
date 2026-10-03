import type { Metadata } from "next";
import { GMINA_OPTIONS } from "@/lib/gminy";
import { MWS_AREAS } from "@/lib/schemas";
import { AREA_LABELS } from "@/lib/taxonomy";
import { DescribeFlow } from "./describe-flow";

export const metadata: Metadata = { title: "Opisz problem" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function Page(props: PageProps<"/opisz">) {
  // ?opis=…&gmina=…&teryt=… przychodzą z wyszukiwarki na stronie startowej.
  const params = await props.searchParams;
  const teryt = first(params.teryt);
  // ?obszar=… przychodzi z przycisku „Opisz problem” na stronie obszaru w Bibliotece i wiedzy.
  const area = MWS_AREAS.find((a) => a === first(params.obszar));
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Opisz problem</h1>
      <p className="max-w-2xl text-lg">
        Napisz swoimi słowami, co jest nie tak. Nie podawaj nazwisk, numerów telefonu ani adresów.
      </p>
      {area && (
        <p className="text-lg">
          Obszar: <strong>{AREA_LABELS[area]}</strong>. Weźmiemy go pod uwagę przy szukaniu rozwiązań.
        </p>
      )}
      <DescribeFlow
        gminy={GMINA_OPTIONS}
        initialText={first(params.opis)}
        initialGmina={{ text: first(params.gmina), teryt: /^\d{7}$/.test(teryt) ? teryt : null }}
        area={area}
      />
    </section>
  );
}
