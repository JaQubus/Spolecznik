import Link from "next/link";
import { EmailOptIn } from "@/components/rozmowa/email-opt-in";
import { PrivateLink } from "@/components/rozmowa/private-link";
import { maskedContactEmail } from "@/lib/author-contact";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusTimeline, type TimelineStep } from "@/components/ui/status-timeline";
import { keyMatches, rememberedKey } from "@/lib/need-access";
import { needTimeline, type NeedStatus } from "@/lib/need-status";
import { needHistory, statusEvents } from "@/lib/panel/needs";
import { createAdminClient } from "@/lib/supabase/admin";
import { AreaBadge } from "@/components/knowledge/icons";

export const metadata = { title: "Status zgłoszenia" };

// Alfabet z lib/status-code.ts: bez 0, 1, I, O.
const CODE = /^SPL-[2-9A-HJ-NP-Z]{4}$/;

type Report = {
  kind: "potrzeba" | "pomysl";
  id: string;
  status: NeedStatus;
  createdAt: string;
  summary: string;
  areas: string[];
  gmina: string | null;
  /** Tylko do sprawdzenia klucza z ciasteczka — nie trafia na stronę. */
  accessHash: string | null;
};

/** Tylko pola bezpieczne do pokazania każdemu, kto zna kod — nigdy surowy tekst ani e-mail. */
async function findReport(code: string): Promise<Report | null> {
  const supabase = createAdminClient();
  const { data: need, error } = await supabase
    .from("needs")
    .select("id, status, created_at, card, access_hash, gminy(nazwa)")
    .eq("status_code", code)
    .maybeSingle();
  if (error) throw error;
  if (need) {
    const card = need.card as { summary?: string; areas?: string[] };
    const gmina = need.gminy as unknown as { nazwa: string } | null;
    return {
      kind: "potrzeba",
      id: need.id,
      status: need.status,
      createdAt: need.created_at,
      summary: card.summary ?? "",
      areas: card.areas ?? [],
      gmina: gmina?.nazwa ?? null,
      accessHash: need.access_hash,
    };
  }

  const { data: idea, error: ideaError } = await supabase
    .from("ideas")
    .select("id, status, created_at, fiszka, access_hash")
    .eq("status_code", code)
    .maybeSingle();
  if (ideaError) throw ideaError;
  if (!idea) return null;
  const fiszka = idea.fiszka as { krotki_opis?: string };
  return {
    kind: "pomysl",
    id: idea.id,
    status: idea.status,
    createdAt: idea.created_at,
    summary: fiszka.krotki_opis ?? "",
    areas: [],
    gmina: null,
    accessHash: idea.access_hash,
  };
}

/** Oś czasu z historii zmian w Panelu: daty kroków i wiadomości ROPS dla zgłaszającego. */
async function timeline(report: Report): Promise<TimelineStep[]> {
  const history = await needHistory(report.id, report.kind === "potrzeba" ? "need" : "idea");
  return needTimeline(report.createdAt, report.status, statusEvents(history));
}

export default async function Page(props: PageProps<"/status/[kod]">) {
  const { kod } = await props.params;
  const code = decodeURIComponent(kod).trim().toUpperCase();

  let report: Report | null = null;
  let steps: TimelineStep[] = [];
  // Klucz autora z tej przeglądarki: tylko wtedy pokazujemy prywatny link (sam kod da się zgadnąć).
  let key: string | null = null;
  let contact: string | null = null;
  let unavailable = false;
  if (CODE.test(code)) {
    try {
      report = await findReport(code);
      if (report) {
        steps = await timeline(report);
        const remembered = await rememberedKey(code);
        key = keyMatches(report.accessHash, remembered) ? remembered : null;
        // Adres do powiadomień tylko dla autora (z kluczem) — i zamaskowany.
        if (key) contact = await maskedContactEmail(report.kind, code).catch(() => null);
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
          jest przepisany dokładnie — ma postać <span className="font-mono">SPL-</span> i cztery znaki, np.{" "}
          <span className="font-mono">SPL-4K7Q</span>.
        </p>
        <Button asChild variant="outline"><Link href="/status">Wpisz kod jeszcze raz</Link></Button>
      </section>
    );
  }

  const closed = report.status === "zamkniete";
  const withExpert = report.status === "ekspert" || report.status === "odpowiedz";

  return (
    <section className="space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">
          {report.kind === "pomysl" ? "Twój pomysł" : "Twoje zgłoszenie"}{" "}
          <span className="font-mono tracking-wider whitespace-nowrap">{code}</span>
        </h1>
        {report.summary && <p className="max-w-[68ch] text-lg">{report.summary}</p>}
        {(report.gmina || report.areas.length > 0) && (
          <ul className="flex flex-wrap gap-2" aria-label="Gmina i obszary">
            {report.gmina && <li><Badge>Gmina {report.gmina}</Badge></li>}
            {report.areas.slice(0, 3).map((a) => (
              <li key={a}><AreaBadge area={a} /></li>
            ))}
          </ul>
        )}
      </div>

      <section aria-labelledby="przebieg" className="space-y-4">
        <h2 id="przebieg" className="text-2xl font-bold">Co się dzieje ze zgłoszeniem</h2>
        <StatusTimeline steps={steps} />
      </section>

      {closed && (
        <Alert tone="success" title="Zgłoszenie jest zamknięte">
          <p>Dziękujemy. Jeśli problem wrócił, opisz go jeszcze raz.</p>
        </Alert>
      )}

      {report.status === "luka" && (
        <div className="max-w-[44rem] space-y-4">
          <Alert title="Nie ma jeszcze gotowego rozwiązania">
            <p>
              Zgłoszenie jest na mapie potrzeb Małopolski, więc ROPS wie, że trzeba tu szukać nowych pomysłów.
              Masz pomysł, jak to rozwiązać? Pomożemy go opisać.
            </p>
          </Alert>
          <Button asChild className="w-full sm:w-auto"><Link href={`/pomysl?potrzeba=${code}`}>Zgłoś pomysł</Link></Button>
        </div>
      )}

      {!closed && (
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={`/zapytaj?kod=${code}`}>
              {withExpert
                ? "Przejdź do rozmowy z ekspertem"
                : `Napisz do ROPS w sprawie ${report.kind === "pomysl" ? "pomysłu" : "zgłoszenia"}`}
            </Link>
          </Button>
          {/* Zaproszenia i rozmowa gmin. Sam kod nie otwiera partnerstwa — /partnerstwo sprawdza klucz z przeglądarki. */}
          {report.kind === "potrzeba" && (
            <Button asChild variant="outline">
              <Link href={`/partnerstwo?potrzeba=${code}`}>Partnerstwo gmin</Link>
            </Button>
          )}
        </div>
      )}

      {key && <PrivateLink code={code} accessKey={key} kind={report.kind} />}
      {key && <EmailOptIn code={code} accessKey={key} current={contact} />}
    </section>
  );
}
