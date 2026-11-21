import { redirect } from "next/navigation";

/** Lista sprawdzonych rozwiązań jest zakładką bazy wiedzy (filtry dziedzin, wyszukiwarka). */
export default function Page() {
  redirect("/wiedza?tab=rozwiazania#dzialy");
}
