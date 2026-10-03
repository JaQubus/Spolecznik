import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <section className="flex flex-col items-start gap-6 py-12">
      <h1 className="text-4xl font-bold sm:text-5xl">Splot</h1>
      <p className="max-w-2xl text-xl">
        Łączymy potrzeby Małopolski z rozwiązaniami, które już działają.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg" className="h-14 px-8 text-lg">
          <Link href="/opisz">Opisz problem</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-14 px-8 text-lg">
          <Link href="/biblioteka">Zobacz bibliotekę rozwiązań</Link>
        </Button>
      </div>
    </section>
  );
}
