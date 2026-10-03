import type { Metadata } from "next";
import { DescribeFlow } from "./describe-flow";

export const metadata: Metadata = { title: "Opisz problem" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function Page(props: PageProps<"/opisz">) {
  // ?opis=…&gmina=… przychodzą z wyszukiwarki na stronie startowej.
  const params = await props.searchParams;
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Opisz problem</h1>
      <p className="max-w-2xl text-lg">
        Napisz swoimi słowami, co jest nie tak. Nie podawaj nazwisk, numerów telefonu ani adresów.
      </p>
      <DescribeFlow initialText={first(params.opis)} initialGmina={first(params.gmina)} />
    </section>
  );
}
