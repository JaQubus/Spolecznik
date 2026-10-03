import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { NoDatabase } from "@/components/layout/no-database";
import { findGminaTopic } from "@/lib/kondycja";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { LINK as linkClass, first } from "../shared";
import { GminyView } from "./gminy-view";
import { PowiatyView } from "./powiaty-view";

export const metadata: Metadata = { title: "Kondycja Małopolski" };

export default async function Page(props: PageProps<"/biblioteka/kondycja">) {
  const params = await props.searchParams;
  const level = first(params.poziom);

  return (
    <div className="space-y-10">
      <p>
        <Link href="/biblioteka" className={cn(linkClass, "inline-flex items-center gap-2")}>
          <ArrowLeft aria-hidden className="size-5" /> Biblioteka i wiedza
        </Link>
      </p>
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Kondycja Małopolski</h1>
        <p className="max-w-2xl text-xl">
          Możesz sprawdzić każdą ze 183 gmin na mapie albo porównać 22 powiaty według ponad 100 wskaźników społecznych.
        </p>
      </header>

      {isSupabaseConfigured() ? (
        <>
          <nav aria-label="Poziom danych" className="flex flex-wrap gap-2">
            <Link href="/biblioteka/kondycja" aria-current={level !== "powiaty"} className="rounded-full border border-border-strong px-4 py-2 font-bold aria-[current=true]:bg-foreground aria-[current=true]:text-background">183 gminy</Link>
            <Link href="/biblioteka/kondycja?poziom=powiaty" aria-current={level === "powiaty"} className="rounded-full border border-border-strong px-4 py-2 font-bold aria-[current=true]:bg-foreground aria-[current=true]:text-background">22 powiaty</Link>
          </nav>
          {level === "powiaty"
            ? <PowiatyView requested={first(params.wskaznik)} />
            : <GminyView topic={findGminaTopic(first(params.temat))} selectedId={first(params.gmina)} />}
        </>
      ) : (
        <NoDatabase />
      )}
    </div>
  );
}
