import { ApplicationForm } from "./application-form";
import { CALL } from "./form-content";
import type { ApplicationPrefill } from "./model";

export const metadata = { title: "Wypełnij wniosek o grant" };

export default async function Page(props: PageProps<"/wniosek">) {
  const params = await props.searchParams;
  const prefill: ApplicationPrefill = {
    tytul: typeof params.tytul === "string" ? params.tytul : undefined,
    problem: typeof params.problem === "string" ? params.problem : undefined,
    opis: typeof params.opis === "string" ? params.opis : undefined,
    odbiorcy: typeof params.odbiorcy === "string" ? params.odbiorcy : undefined,
  };
  const hasPrefill = Object.values(prefill).some((value) => value?.trim());

  return (
    <section className="space-y-8">
      <div className="space-y-4 print:hidden">
        <h1 className="text-3xl font-bold">Wypełnij wniosek o grant</h1>
        <p className="max-w-2xl text-lg">
          Formularz aplikacyjny do naboru „{CALL.title}” (ROPS w Krakowie). Przeprowadzimy Cię przez niego krok po kroku,
          a na końcu dostaniesz wypełniony wniosek do wydruku, podpisu i wysłania.
        </p>
        <p className="max-w-2xl">Zajmie to około godziny. Przygotuj dane kontaktowe, krótki opis pomysłu i szacunkowe koszty.</p>
      </div>
      <ApplicationForm prefill={hasPrefill ? prefill : undefined} />
    </section>
  );
}
