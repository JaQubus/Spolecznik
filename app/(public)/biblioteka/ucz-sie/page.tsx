import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ucz się" };

type Material = {
  id: string;
  title: string;
  description: string;
  audience: string;
  kind: "pdf" | "strona";
  url: string;
  publisher: string;
  year: number | null;
};

const linkClass = "inline-flex items-center gap-2 font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

export default async function Page() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .select("id, title, description, audience, kind, url, publisher, year")
    .order("sort")
    .order("title");
  if (error) throw error;
  const materials = data as Material[];

  return (
    <div className="space-y-10">
      <p>
        <Link href="/biblioteka" className={linkClass}>
          <ArrowLeft aria-hidden className="size-5" /> Biblioteka i wiedza
        </Link>
      </p>
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Ucz się</h1>
        <p className="max-w-2xl text-xl">
          Przewodniki, raporty i narzędzia ROPS o innowacjach społecznych i o problemach, które rozwiązują. Każdy materiał opisaliśmy w kilku zdaniach, żeby łatwiej było wybrać.
        </p>
      </header>

      {materials.length === 0 ? (
        <p className="text-lg">Nie ma jeszcze materiałów.</p>
      ) : (
        <ul className="max-w-3xl border-t">
          {materials.map((m) => (
            <li key={m.id} className="grid gap-2 border-b py-6">
              <h2 className="text-xl font-bold">{m.title}</h2>
              <p className="text-base text-muted-foreground">
                {m.audience} · {m.publisher}{m.year ? `, ${m.year}` : ""}
              </p>
              <p className="max-w-[68ch]">{m.description}</p>
              <p className="mt-1">
                <a href={m.url} className={linkClass}>
                  {m.kind === "pdf" ? <FileText aria-hidden className="size-5" /> : <ExternalLink aria-hidden className="size-5" />}
                  {m.kind === "pdf" ? "Otwórz PDF" : "Przejdź na stronę ROPS"}
                  <span className="sr-only">: {m.title}</span>
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
