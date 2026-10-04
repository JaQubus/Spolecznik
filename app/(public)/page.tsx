import Link from "next/link";
import { GMINA_OPTIONS } from "@/lib/gminy";
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
        <SearchBar gminy={GMINA_OPTIONS} />
      </section>
      <ul className="mt-10 space-y-1">
        <li>
          <Link href="/biblioteka" className="inline-flex min-h-12 items-center font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
            Zobacz bibliotekę rozwiązań
          </Link>
        </li>
        <li>
          {/* Tester nie ma miejsca w menu (6 pozycji), a bez tego linku dało się do niego dojść tylko z wyników „Opisz problem”. */}
          <Link href="/przetestuj" className="inline-flex min-h-12 items-center font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
            Przetestuj rozwiązanie u siebie i oceń je
          </Link>
        </li>
      </ul>
    </>
  );
}
