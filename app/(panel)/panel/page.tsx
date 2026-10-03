import Link from "next/link";
import { TodoPage } from "@/components/layout/todo-page";

export const metadata = { title: "Panel ROPS" };

const READY = [
  { href: "/panel/trendy", label: "Trendy potrzeb", text: "zgłoszenia według obszaru, powiatu i słów kluczowych, eksport CSV" },
  { href: "/panel/wiedza", label: "Zarządzaj wiedzą", text: "innowacje, fakty, materiały i opisy obszarów z automatycznym reindeksem" },
];

export default function Page() {
  return (
    <div className="space-y-10">
      <TodoPage title="Panel ROPS" items={[
        "Skrzynka zgłoszeń z triage AI: obszar, duplikaty, sugerowany ekspert, ostrzeżenie o danych osobowych",
        "Włącznik naborów",
        "Mapa luk, log zmian",
      ]} />
      <section aria-labelledby="gotowe" className="space-y-3">
        <h2 id="gotowe" className="text-2xl font-bold">Gotowe</h2>
        <ul className="space-y-2">
          {READY.map((r) => (
            <li key={r.href}>
              <Link href={r.href} className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">{r.label}</Link> — {r.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
