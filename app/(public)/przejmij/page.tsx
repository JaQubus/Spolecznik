import type { Metadata } from "next";
import { NoDatabase } from "@/components/layout/no-database";
import { Alert } from "@/components/ui/alert";
import { brand, org } from "@/lib/brand";
import { rememberedKey } from "@/lib/initiatives/access";
import { SOURCE_LABELS, SOURCE_RECORD_KIND_LABELS, STATUS_CODE } from "@/lib/schemas";
import { claimView } from "@/lib/sources";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { ClaimForm } from "./claim-form";

export const metadata: Metadata = { title: "Przejmij zgłoszenie", robots: { index: false } };

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

/** „Przejmij zgłoszenie” (7/10): twórca potwierdza i uzupełnia kartę inicjatywy, którą Radar znalazł w źródłach. */
export default async function Page(props: PageProps<"/przejmij">) {
  if (!isSupabaseConfigured()) return <NoDatabase />;
  const sp = await props.searchParams;
  const code = (typeof sp.kod === "string" ? sp.kod : "").trim().toUpperCase();
  const view = STATUS_CODE.test(code) ? await claimView(code, await rememberedKey(code)) : null;

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Przejmij zgłoszenie</h1>
        <p className="max-w-2xl text-xl">
          {brand.name} {org.short} znalazł Wasze rozwiązanie w publicznych źródłach. Sprawdź, czy dobrze je opisaliśmy,
          popraw, co trzeba, i potwierdź. Dopiero wtedy zgłoszenie trafi do zespołu, a po weryfikacji — do bazy innowacji.
        </p>
      </header>

      {!view ? (
        <Alert tone="warning" title="Link do przejęcia jest nieaktualny">
          <p>Zgłoszenie mogło zostać już przejęte albo zespół wysłał nowszy link. Napisz do zespołu {org.short}, żeby dostać nowy.</p>
        </Alert>
      ) : (
        <>
          {view.source && (
            <section aria-labelledby="skad" className="max-w-[44rem] space-y-2 rounded-[16px] bg-secondary px-5 py-4">
              <h2 id="skad" className="text-lg font-bold">Skąd je znamy</h2>
              <p>
                {SOURCE_LABELS[view.source.source]}, {SOURCE_RECORD_KIND_LABELS[view.source.kind]}:{" "}
                {view.source.url
                  ? <a href={view.source.url} target="_blank" rel="noopener noreferrer" className={linkClass}>{view.source.title}<span className="sr-only"> (otwiera się w nowej karcie)</span></a>
                  : view.source.title}
                {view.source.institution && `, ${view.source.institution}`}
              </p>
              <p className="text-muted-foreground">Kod zgłoszenia: <span className="font-mono tracking-wider">{view.code}</span></p>
            </section>
          )}
          <ClaimForm code={view.code} card={view.card} />
        </>
      )}
    </article>
  );
}
