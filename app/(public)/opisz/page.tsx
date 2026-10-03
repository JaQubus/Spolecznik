import type { Metadata } from "next";
import { DescribeFlow } from "./describe-flow";

export const metadata: Metadata = { title: "Opisz problem" };

export default function Page() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Opisz problem</h1>
      <p className="max-w-2xl text-lg">
        Napisz swoimi słowami, co jest nie tak. Nie podawaj nazwisk, numerów telefonu ani adresów.
      </p>
      <DescribeFlow />
    </section>
  );
}
