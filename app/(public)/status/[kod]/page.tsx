import Link from "next/link";
import { EmailOptIn } from "@/components/rozmowa/email-opt-in";
import { PrivateLink } from "@/components/rozmowa/private-link";
import { DomainBadge } from "@/components/taxonomy/icons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusTimeline, type TimelineStep } from "@/components/ui/status-timeline";
import { AuthorAssessmentSection } from "@/components/radar/author-assessment";
import { maskedContactEmail } from "@/lib/author-contact";
import { authorAssessment, type AuthorAssessment } from "@/lib/initiatives/assessment";
import { keyMatches, rememberedKey } from "@/lib/initiatives/access";
import { initiativeTimeline, type InitiativeStatus } from "@/lib/initiatives/status";
import { initiativeHref } from "@/lib/knowledge/hrefs";
import { initiativeHistory, statusEvents } from "@/lib/panel/initiatives";
import { createAdminClient } from "@/lib/supabase/admin";
import { brand, org, STATUS_CODE } from "@/lib/brand";

export const metadata = { title: "Status zgłoszenia" };

type Report = {
  id: string;
  status: InitiativeStatus;
  createdAt: string;
  title: string;
  summary: string;
  domains: string[];
  gmina: string | null;
  submissionKind: "own" | "nomination";
  /** Link do strony publicznej, gdy zespół opublikował inicjatywę. */
  publicHref: string | null;
  /** Tylko do sprawdzenia klucza z ciasteczka — nie trafia na stronę. */
  accessHash: string | null;
};

/** Tylko pola bezpieczne do pokazania każdemu, kto zna kod — nigdy surowy tekst ani e-mail. */
async function findReport(code: string): Promise<Report | null> {
  const { data, error } = await createAdminClient()
    .from("initiatives")
    .select("id, status, created_at, title, summary, domains, submission_kind, published, slug, duplicate_of, access_hash, municipalities(name)")
    .eq("status_code", code)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const visible = data.published && !data.duplicate_of && data.status !== "archived" && data.slug;
  return {
    id: data.id,
    status: data.status,
    createdAt: data.created_at,
    title: data.title,
    summary: data.summary,
    domains: data.domains ?? [],
    gmina: (data.municipalities as unknown as { name: string } | null)?.name ?? null,
    submissionKind: data.submission_kind,
    publicHref: visible ? initiativeHref(data.slug as string) : null,
    accessHash: data.access_hash,
  };
}

export default async function Page(props: PageProps<"/status/[kod]">) {
  const { kod } = await props.params;
  const code = decodeURIComponent(kod).trim().toUpperCase();

  let report: Report | null = null;
  let steps: TimelineStep[] = [];
  // Klucz autora z tej przeglądarki: tylko wtedy pokazujemy prywatny link (sam kod da się zgadnąć).
  let key: string | null = null;
  let contact: string | null = null;
  let assessment: AuthorAssessment | null = null;
  let unavailable = false;
  if (STATUS_CODE.test(code)) {
    try {
      report = await findReport(code);
      if (report) {
        steps = initiativeTimeline(report.createdAt, report.status, statusEvents(await initiativeHistory(report.id)));
        const remembered = await rememberedKey(code);
        key = keyMatches(report.accessHash, remembered) ? remembered : null;
        // Adres do powiadomień tylko dla autora (z kluczem) — i zamaskowany.
        if (key) {
          [contact, assessment] = await Promise.all([
            maskedContactEmail(code).catch(() => null),
            // Ocena radaru tylko dla autora: zawiera cytaty z opisu, który bez publikacji jest prywatny.
            authorAssessment(code, key).catch((e): AuthorAssessment | null => { console.error("[status] ocena radaru:", e); return null; }),
          ]);
        }
      }
    } catch (e) {
      console.error("[status]", e);
      unavailable = true;
    }
  }

  if (unavailable) {
    return (
      <section className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Status zgłoszenia</h1>
        <Alert tone="error" title="Nie udało się sprawdzić statusu">
          <p>Sprawdzanie statusu jest chwilowo niedostępne. Spróbuj ponownie za kilka minut.</p>
        </Alert>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Nie znaleźliśmy tego zgłoszenia</h1>
        <p className="text-lg">
          Nie ma zgłoszenia o kodzie <strong className="font-mono tracking-wider">{code}</strong>. Sprawdź, czy kod
          jest przepisany dokładnie — ma postać <span className="font-mono">{brand.statusPrefix}-</span> i cztery znaki, np.{" "}
          <span className="font-mono">{brand.statusExample}</span>.
        </p>
        <Button asChild variant="outline"><Link href="/status">Wpisz kod jeszcze raz</Link></Button>
      </section>
    );
  }

  const closed = report.status === "archived";

  return (
    <section className="space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">
          {report.submissionKind === "nomination" ? "Twoje wskazanie" : report.status === "detected" ? "Wykryte zgłoszenie" : "Twoje zgłoszenie"}{" "}
          <span className="font-mono tracking-wider whitespace-nowrap">{code}</span>
        </h1>
        <p className="max-w-[68ch] text-lg"><strong>{report.title}.</strong> {report.summary}</p>
        {(await props.searchParams).przejeto === "1" && key && (
          <Alert tone="success" title="Dziękujemy, zgłoszenie jest Wasze">
            <p>Karta trafiła do zespołu. Ten sam prywatny link prowadzi teraz do statusu i rozmowy z zespołem.</p>
          </Alert>
        )}
        {(report.gmina || report.domains.length > 0) && (
          <ul className="flex flex-wrap gap-2" aria-label="Gmina i dziedziny">
            {report.gmina && <li><Badge>Gmina {report.gmina}</Badge></li>}
            {report.domains.slice(0, 3).map((d) => <li key={d}><DomainBadge domain={d} /></li>)}
          </ul>
        )}
      </div>

      <section aria-labelledby="przebieg" className="space-y-4">
        <h2 id="przebieg" className="text-2xl font-bold">Co się dzieje ze zgłoszeniem</h2>
        <StatusTimeline steps={steps} />
      </section>

      {key && report.status !== "detected" && (
        <div className="space-y-3">
          <AuthorAssessmentSection code={code} accessKey={key} initial={assessment} idPrefix="status-ocena" />
          <p>
            <Link href={`/rozmowy?kod=${code}#kontakty`} className="underline decoration-1 underline-offset-4 hover:decoration-2">
              Ścieżki rozwoju i dopasowani partnerzy
            </Link>{" "}
            są w rozmowie z zespołem {org.short}. Tam możesz poprosić o kontakt z partnerem.
          </p>
        </div>
      )}

      {report.publicHref && (
        <p className="text-lg">
          Inicjatywa jest w publicznej bazie:{" "}
          <Link href={report.publicHref} className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">zobacz jej stronę</Link>.
        </p>
      )}

      {closed && (
        <Alert title="Zgłoszenie jest zamknięte">
          <p>Dziękujemy. Jeśli inicjatywa ruszyła na nowo albo się rozwinęła, zgłoś ją jeszcze raz.</p>
        </Alert>
      )}

      {!closed && (
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={`/rozmowy?kod=${code}`}>Napisz do zespołu {org.short}</Link>
          </Button>
        </div>
      )}

      {key && <PrivateLink code={code} accessKey={key} />}
      {key && <EmailOptIn code={code} accessKey={key} current={contact} />}
    </section>
  );
}
