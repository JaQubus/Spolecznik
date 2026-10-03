import { TodoPage } from "@/components/layout/todo-page";

export const metadata = { title: "Logowanie" };

export default function Page() {
  return <TodoPage title="Logowanie" items={["Supabase Auth: magic link e-mailem (JST, eksperci, admin ROPS)"]} />;
}
