import { TodoPage } from "@/components/layout/todo-page";

export const metadata = { title: "Zgłoś pomysł" };

export default function Page() {
  return <TodoPage title="Zgłoś pomysł" items={[
    "Fiszka: krótki opis, istota, dla kogo, etap (wstępnie wypełniona z luki)",
    "Canvas INNO AGH jako formularz z JSON",
    "Asystent (Sonnet) ze sprawdzaniem nowości tym samym silnikiem",
    "Generator wniosków przy aktywnym naborze",
    "Po wysłaniu: kod zgłoszenia SPL-XXXX",
  ]} />;
}
