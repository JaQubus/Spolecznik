import Link from "next/link";
import { org } from "@/lib/brand";

export default function Forbidden() {
  return (
    <section className="max-w-[68ch] space-y-4">
      <h1 className="text-3xl font-bold">Ta część jest tylko dla pracowników {org.short}</h1>
      <p>Jesteś zalogowany, ale Twoje konto nie ma dostępu do Panelu. Jeśli pracujesz w {org.short}, poproś administratora o nadanie uprawnień.</p>
      <p><Link href="/" className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">Wróć na stronę główną</Link></p>
    </section>
  );
}
