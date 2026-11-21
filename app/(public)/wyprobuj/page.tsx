import { GMINA_OPTIONS } from "@/lib/gminy";
import { pickSource, sourceOptions } from "@/lib/patterns";
import { AdoptionForm } from "./adoption-form";

export const metadata = { title: "Wypróbowaliśmy u nas" };

export default async function Page(props: PageProps<"/wyprobuj">) {
  const params = await props.searchParams;
  const sources = await sourceOptions().catch(() => []);
  const source = pickSource({ inicjatywa: params.inicjatywa, rozwiazanie: params.rozwiazanie }, sources);

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Wypróbowaliśmy u nas</h1>
        <p className="max-w-2xl text-lg">
          Przenosicie inicjatywę z innej gminy albo sprawdzone rozwiązanie? Daj znać, a po pilotażu oceń, jak poszło.
          Oceny widzą inne gminy, a udane przeniesienia podnoszą ocenę przenaszalności na radarze.
        </p>
      </div>
      <AdoptionForm sources={sources} gminy={GMINA_OPTIONS} initialSource={source} />
    </section>
  );
}
