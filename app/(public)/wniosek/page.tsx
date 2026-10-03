import { ApplicationForm } from "./application-form";
import { CALL } from "./form-content";

export const metadata = { title: "Wypełnij wniosek o grant" };

export default function Page() {
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
      <ApplicationForm />
    </section>
  );
}
