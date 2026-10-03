import { TodoPage } from "@/components/layout/todo-page";

export const metadata = { title: "Jak to wdrożyć u nas?" };

export default function Page() {
  return <TodoPage title="Jak to wdrożyć u nas?" items={[
    "Wybór innowacji i gminy",
    "Karta wdrożeniowa: cel, odbiorcy (liczby z BDL), forma usługi, kroki, kadra, koszty (szacunek), partnerzy, ryzyka, wskaźniki",
    "Założenia jawnie oznaczone",
    "Przycisk „Chcę przetestować”",
  ]} />;
}
