import Link from "next/link";
import { Button } from "@/components/ui/button";

// Szablon tytułu z layoutu nie obejmuje not-found, więc tytuł jest pełny.
const LINKS = [
  { href: "/opisz", label: "Opisz problem" },
  { href: "/biblioteka", label: "Biblioteka i wiedza" },
  { href: "/status", label: "Sprawdź status zgłoszenia" },
];

/** 404 dla nieznanych adresów i dla notFound() w podstronach. */
export default function NotFound() {
  return (
    <section className="max-w-2xl space-y-6">
      <title>Nie ma takiej strony · Społecznik</title>
      <h1 className="text-3xl font-bold">Nie ma takiej strony</h1>
      <p className="text-lg">
        Adres mógł się zmienić albo zawierać literówkę. Sprawdź go jeszcze raz albo zacznij od strony głównej.
      </p>
      <Button asChild className="w-full sm:w-auto"><Link href="/">Przejdź na stronę główną</Link></Button>
      <div className="space-y-3 pt-4">
        <h2 className="text-xl font-bold">Sprawdź też</h2>
        <ul>
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-flex min-h-12 items-center font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
