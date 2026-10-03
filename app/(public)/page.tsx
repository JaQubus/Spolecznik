import Link from "next/link";
import { SearchBar } from "./search-bar";

export default function Home() {
  return (
    <>
      {/* Kremowy pas pod nagłówkiem: białe pola na kremowym tle najlepiej odróżniają się od strony. */}
      <section className="full-bleed -mt-8 space-y-8 bg-secondary py-12 md:py-16">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold sm:text-5xl">Społecznik</h1>
          <p className="max-w-2xl text-xl">
            Łączymy potrzeby Małopolski z rozwiązaniami, które już działają.
          </p>
        </div>
        <SearchBar />
      </section>
      <p className="mt-10">
        <Link href="/biblioteka" className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
          Zobacz bibliotekę rozwiązań
        </Link>
      </p>
    </>
  );
}
