import { TodoPage } from "@/components/layout/todo-page";

export const metadata = { title: "Przetestuj rozwiązanie" };

export default function Page() {
  return <TodoPage title="Przetestuj rozwiązanie" items={[
    "„Chcę przetestować”: kto, gdzie, kiedy (innowacja z ?innowacja=ID)",
    "Po teście ocena 1–5 (przyciski radiowe) + co działa i co poprawić",
    "Na karcie innowacji: „Przetestowano w N gminach, średnio X”",
  ]} />;
}
