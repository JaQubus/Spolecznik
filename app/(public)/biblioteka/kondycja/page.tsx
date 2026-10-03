import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { NoDatabase } from "@/components/layout/no-database";
import { findGminaTopic } from "@/lib/kondycja";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { LINK as linkClass, first } from "../shared";
import { GminyView } from "./gminy-view";

export const metadata: Metadata = { title: "Kondycja Małopolski" };

export default async function Page(props: PageProps<"/biblioteka/kondycja">) {
  const params = await props.searchParams;

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
          Wybierz temat, a zobaczysz, jak wygląda w każdej ze 183 gmin. Kliknij gminę, żeby zobaczyć jej najważniejsze liczby i pasujące rozwiązania.
        </p>
      </header>

      {isSupabaseConfigured() ? (
        <GminyView topic={findGminaTopic(first(params.temat))} selectedId={first(params.gmina)} />
      ) : (
        <NoDatabase />
      )}
    </div>
  );
}
