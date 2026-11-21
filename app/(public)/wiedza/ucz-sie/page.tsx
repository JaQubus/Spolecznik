import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { MaterialList } from "@/components/knowledge/material-list";
import { knowledge } from "@/lib/knowledge";
import { ICON_LINK as linkClass } from "../shared";

export const metadata: Metadata = { title: "Ucz się" };

/** Przewodniki, raporty i narzędzia: jak rozwijać, mierzyć i przenosić inicjatywy. Ta sama tabela co zakładka „Materiały”. */
export default async function Page() {
  const materials = await knowledge.materials();
  return (
    <div className="space-y-10">
      <p>
        <Link href="/wiedza" className={linkClass}>
          <ArrowLeftIcon aria-hidden className="size-5" /> Wiedza
        </Link>
      </p>
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Ucz się</h1>
        <p className="max-w-2xl text-xl">
          Przewodniki, raporty i narzędzia o tym, jak rozwinąć inicjatywę, sprawdzić jej efekty i przenieść ją gdzie indziej.
          Każdy materiał opisaliśmy w kilku zdaniach, żeby łatwiej było wybrać.
        </p>
      </header>
      {materials.length === 0 ? <p className="text-lg">Nie ma jeszcze materiałów.</p> : <MaterialList items={materials} headingLevel={2} />}
    </div>
  );
}
