import type { Metadata } from "next";
import { NoDatabase } from "@/components/layout/no-database";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { org, region } from "@/lib/brand";
import { PartnerForm } from "./partner-form";

export const metadata: Metadata = {
  title: "Szukam innowacji",
  description: `Dla firm, funduszy, centrów transferu technologii i samorządów: znajdź innowacje ${region.genitive} do wdrożenia lub finansowania.`,
};

/** Wejście dla partnera i inwestora (8/10): profil organizacji i alerty o nowych innowacjach. */
export default function Page() {
  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Szukam innowacji do wdrożenia lub finansowania</h1>
        <p className="max-w-2xl text-xl">
          Opisz, czego szukasz. Pokażemy innowacje {region.genitive}, które już pasują, i będziemy powiadamiać o nowych.
          Zespół {org.short} zatwierdzi Twój profil, a kontakt z twórcą zestawi wtedy, gdy zgodzą się obie strony.
        </p>
      </header>
      {isSupabaseConfigured() ? <PartnerForm /> : <NoDatabase />}
    </section>
  );
}
