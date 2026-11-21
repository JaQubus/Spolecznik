import type { Metadata } from "next";
import Link from "next/link";
import { NoDatabase } from "@/components/layout/no-database";
import { listPublicInstitutions } from "@/lib/innovations/public-institutions";
import { publicInitiativesAvailable } from "@/lib/initiatives/public";
import { createPublicClient } from "@/lib/supabase/public";
import { plural } from "@/lib/pl";
import { institutionLabel } from "@/lib/taxonomy";
import { region } from "@/lib/brand";

// Dane z bazy: strona nie jest budowana statycznie.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Instytucje", description: `Szkoły, uczelnie i samorządy ${region.genitive}, które zgłaszają innowacje.` };

/** Instytucje z opublikowanymi innowacjami (najpierw te z największą liczbą), potem pozostałe. */
export default async function Page() {
  if (!publicInitiativesAvailable()) return <NoDatabase />;
  const [institutions, rows] = await Promise.all([
    listPublicInstitutions(),
    createPublicClient().from("public_initiatives").select("institution_id").not("institution_id", "is", null).limit(5000),
  ]);
  if (rows.error) throw rows.error;
  const counts = new Map<string, number>();
  for (const r of rows.data ?? []) counts.set(r.institution_id as string, (counts.get(r.institution_id as string) ?? 0) + 1);
  const list = institutions
    .map((i) => ({ ...i, count: counts.get(i.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pl"));

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Instytucje</h1>
        <p className="max-w-2xl text-xl">
          Szkoły, uczelnie i samorządy {region.genitive}. Zobacz, co zgłosiły, i zgłoś własną innowację.
        </p>
      </header>
      <ul className="max-w-[56rem] divide-y divide-border border-y border-border">
        {list.map((i) => (
          <li key={i.id} className="space-y-1 py-4">
            <h2 className="text-xl font-bold">
              <Link href={`/instytucje/${encodeURIComponent(i.slug)}`} className="underline decoration-1 underline-offset-4 hover:decoration-2">{i.name}</Link>
            </h2>
            <p className="text-base text-muted-foreground">
              {institutionLabel(i.institution_type)} · {i.count} {plural(i.count, "innowacja", "innowacje", "innowacji")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
