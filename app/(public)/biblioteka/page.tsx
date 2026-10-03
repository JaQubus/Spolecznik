import { TodoPage } from "@/components/layout/todo-page";

export const metadata = { title: "Biblioteka i wiedza" };

export default function Page() {
  return <TodoPage title="Biblioteka i wiedza" items={[
    "Innowacje jako historie: Problem → Rozwiązanie → Skąd wiemy, że działa → Jak skorzystać",
    "Filtry „dla kogo” (9 kategorii) z ikonami i tekstem",
    "Streszczenie w tekście łatwym do czytania",
    "Kondycja Małopolski: mapa gmin z BDL",
    "Zapytaj Bibliotekę: Q&A po raportach z odnośnikami do stron PDF",
  ]} />;
}
