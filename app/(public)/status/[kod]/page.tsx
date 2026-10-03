import { TodoPage } from "@/components/layout/todo-page";

export default async function Page(props: PageProps<"/status/[kod]">) {
  const { kod } = await props.params;
  return <TodoPage title={`Zgłoszenie ${decodeURIComponent(kod)}`} items={[
    "Oś czasu statusów: Zgłoszone → W analizie → Przypisano eksperta → Odpowiedź",
    "Pobranie zgłoszenia po status_code (bez logowania)",
    "Link do wątku z ekspertem",
  ]} />;
}
