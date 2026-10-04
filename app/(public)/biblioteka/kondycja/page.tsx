import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { NoDatabase } from "@/components/layout/no-database";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { LINK as linkClass, first } from "../shared";
import { KondycjaView } from "./kondycja-view";

export const metadata: Metadata = { title: "Kondycja Małopolski" };

export default async function Page(props: PageProps<"/biblioteka/kondycja">) {
  const params = await props.searchParams;
  const layer = first(params.poziom) === "powiaty" ? "powiaty" : "gminy";

  return (
    <div className="space-y-10">
      <p>
        <Link href="/biblioteka" className={cn(linkClass, "inline-flex items-center gap-2")}>
          <ArrowLeftIcon aria-hidden className="size-5" /> Biblioteka i wiedza
        </Link>
      </p>
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Kondycja Małopolski</h1>
        <p className="max-w-2xl text-xl">
          Sprawdź na mapie każdą ze 183 gmin i każdy z 22 powiatów. Wybierz kategorię i wskaźnik, a potem kliknij gminę albo powiat, żeby zobaczyć jego kartę.
        </p>
      </header>

      {isSupabaseConfigured() ? (
        // ?gmina= to stare linki do karty gminy (sprzed wspólnego widoku gmin i powiatów).
        <KondycjaView layer={layer} requested={first(params.wskaznik)} selectedId={first(params.id) || first(params.gmina)} />
      ) : (
        <NoDatabase />
      )}
    </div>
  );
}
