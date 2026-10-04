import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { getPlan } from "@/lib/panel/plans";
import { todayInPoland } from "@/lib/pl";
import type { PlanDocument } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { UW_CONTENT, formatDay } from "@/lib/usluga-wrazliwa";
import { GrantForm } from "./grant-form";

export const metadata = { title: "Wniosek o grant „Usługa Wrażliwa”" };

const link = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/**
 * Plan wdrożenia z /wdrozenie po id z linku „Przejdź do wniosku o grant”. Id (uuid) działa jak klucz: plan nie zawiera
 * danych osobowych (kadra przechodzi przez anonymize), a bez konta autor nie miałby jak wrócić do swojego planu.
 */
async function loadPlan(id: string): Promise<{ plan: PlanDocument; slug: string | null } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createAdminClient();
  const plan = await getPlan(supabase, id);
  if (!plan) return null;
  const { data } = await supabase.from("innovations").select("slug").eq("id", plan.innovation.id).maybeSingle();
  return { plan, slug: (data?.slug as string | null) ?? null };
}

export default async function Page(props: PageProps<"/wniosek-o-grant">) {
  // Domyślne daty liczymy od dzisiaj, a plan czytamy z bazy: strona nie może się prerenderować przy buildzie.
  await connection();
  const params = await props.searchParams;
  const planId = typeof params.plan === "string" && z.uuid().safeParse(params.plan).success ? params.plan : null;
  const loaded = planId ? await loadPlan(planId).catch((e) => { console.error("[wniosek-o-grant] plan", e); return null; }) : null;
  const content = UW_CONTENT;
  const today = todayInPoland();
  const inCall = loaded ? content.innovations.some((i) => i.slug === loaded.slug) : true;

  return (
    <section className="space-y-8">
      <div className="space-y-4 print:hidden">
        <h1 className="text-3xl font-bold">Wniosek o grant „Usługa Wrażliwa”</h1>
        <p className="max-w-2xl text-lg">
          Szkic wniosku do naboru Regionalnego Ośrodka Polityki Społecznej w Krakowie na wdrożenie usługi społecznej opartej
          na innowacji: grant do 600 tys. zł, bez wkładu własnego. Wniosek składa się przez{" "}
          <a href={content.call.formUrl} className={link}>formularz elektroniczny ROPS</a>. Tutaj przygotujesz jego treść.
        </p>
        {loaded ? (
          <Alert tone="success" title="Wypełniliśmy wniosek z Twojego planu wdrożenia">
            <p>
              Opis usługi, odbiorców, plan działań, koszty i trwałość pochodzą z planu „{loaded.plan.innovation.title}” dla gminy {loaded.plan.gmina.nazwa}.
              Uzupełnij dane wnioskodawcy, doświadczenie i oświadczenia, a resztę sprawdź i popraw.
            </p>
          </Alert>
        ) : planId ? (
          <Alert tone="error" title="Nie znaleźliśmy tego planu wdrożenia">
            <p>Możesz wypełnić wniosek od początku albo <Link href="/wdrozenie" className={link}>przygotować nowy plan</Link>.</p>
          </Alert>
        ) : (
          <p className="max-w-2xl">
            Masz już plan wdrożenia? <Link href="/wdrozenie" className={link}>Zacznij od „Jak to wdrożyć u nas?”</Link>, a wniosek
            wypełni się sam. Zajmie to około 10 minut zamiast godziny.
          </p>
        )}
        {today > content.call.closesAt && (
          <Alert title={`Nabór zakończył się ${formatDay(content.call.closesAt)}`}>
            <p>
              Teraz nie da się złożyć tego wniosku. Szkic możesz przygotować na kolejny nabór „Usługi Wrażliwej”: sprawdź na{" "}
              <a href={content.call.url} className={link}>stronie ROPS</a>, czy został ogłoszony, i porównaj listę innowacji.
            </p>
          </Alert>
        )}
        {!inCall && loaded && (
          <Alert title="Tej innowacji nie ma w obecnym naborze">
            <p>
              „{loaded.plan.innovation.title}” nie jest na liście innowacji tego naboru. Opis z planu zostaje, ale w kroku 1 wybierz
              innowację z listy albo sprawdź na <a href={content.call.url} className={link}>stronie naboru</a>, czy ROPS ogłosił kolejny.
            </p>
          </Alert>
        )}
      </div>
      <GrantForm content={content} plan={loaded?.plan ?? null} planSlug={loaded?.slug ?? null} today={today} />
    </section>
  );
}
