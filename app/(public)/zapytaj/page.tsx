import { TodoPage } from "@/components/layout/todo-page";

export const metadata = { title: "Zapytaj eksperta" };

export default function Page() {
  return <TodoPage title="Zapytaj eksperta" items={[
    "Wątek przypięty do karty (?innowacja=ID, ?potrzeba=KOD) na Supabase Realtime",
    "Podpowiedź eksperta z indeksu (?ekspert=ID)",
    "Partnerstwa: wątek grupowy gmin z podobnym problemem (?partnerstwo=1)",
    "„Zapytaj ROPS”: AI odpowiada z Zasobnika i przekazuje sprawę człowiekowi",
  ]} />;
}
