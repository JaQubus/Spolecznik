import { ArrowLeftIcon, ArrowTopRightOnSquareIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { NoDatabase } from "@/components/layout/no-database";
import { ICON_LINK as linkClass } from "../shared";
import { createClient, isMissingTable, isSupabaseConfigured } from "@/lib/supabase/server";

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


async function listMaterials(): Promise<Material[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .select("id, title, description, audience, kind, url, publisher, year")
    .order("sort")
    .order("title");
  if (isMissingTable(error)) return []; // migracja 0008 jeszcze nie uruchomiona
  if (error) throw error;
  return data as Material[];
}

export default async function Page() {
  const connected = isSupabaseConfigured();
  const materials = connected ? await listMaterials() : [];

  return (
    <div className="space-y-10">
      <p>
        <Link href="/biblioteka" className={`inline-flex min-h-12 items-center gap-2 ${linkClass}`}>
          <ArrowLeftIcon aria-hidden className="size-5" /> Biblioteka i wiedza
        </Link>
      </p>
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Ucz się</h1>
        <p className="max-w-2xl text-xl">
          Przewodniki, raporty i narzędzia ROPS o innowacjach społecznych i o problemach, które rozwiązują. Każdy materiał opisaliśmy w kilku zdaniach, żeby łatwiej było wybrać.
        </p>
      </header>

      {!connected ? (
        <NoDatabase />
      ) : materials.length === 0 ? (
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
                  {m.kind === "pdf" ? <DocumentTextIcon aria-hidden className="size-5" /> : <ArrowTopRightOnSquareIcon aria-hidden className="size-5" />}
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
