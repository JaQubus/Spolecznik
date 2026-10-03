import { TodoPage } from "@/components/layout/todo-page";

export const metadata = { title: "Panel ROPS" };

export default function Page() {
  return <TodoPage title="Panel ROPS" items={[
    "Skrzynka zgłoszeń z triage AI: obszar, duplikaty, sugerowany ekspert, ostrzeżenie o danych osobowych",
    "CRUD innowacji z automatycznym reindeksem (/api/index-card)",
    "Włącznik naborów",
    "Trendy: obszar × powiat × czas",
    "Mapa luk, eksport CSV, log zmian",
  ]} />;
}
