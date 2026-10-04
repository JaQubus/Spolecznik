import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { assignedReports, requireExpert } from "@/lib/expert";
import { NEED_STATUS_LABELS, type NeedStatus } from "@/lib/need-status";
import { formatDate } from "@/lib/pl";

export const metadata = { title: "Moje zgłoszenia · Ekspert" };

const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/** Wejście dla eksperta (#63): tylko zgłoszenia i pomysły, przy których ROPS poprosił go o pomoc. */
export default async function Page() {
  const { expert } = await requireExpert();
  if (!expert) {
    return (
      <section className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold">Zgłoszenia do pomocy</h1>
        <Alert title="Nie znaleźliśmy Twojego profilu eksperta">
          <p>Poproś ROPS o dopisanie Cię do bazy ekspertów. Do tego czasu nie możemy pokazać przypisanych zgłoszeń.</p>
        </Alert>
      </section>
    );
  }
  const reports = await assignedReports(expert.id);

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Zgłoszenia do pomocy</h1>
        <p className="max-w-2xl text-lg">
          Jesteś zalogowany jako <strong>{expert.name}</strong>. Tu są zgłoszenia i pomysły, przy których ROPS prosi Cię
          o pomoc. Odpowiadasz bezpośrednio autorowi; ROPS widzi rozmowę.
        </p>
      </div>
      {reports.length === 0 ? (
        <p className="text-lg">Nie masz jeszcze przypisanych zgłoszeń. Damy znać w powiadomieniach, gdy ROPS poprosi Cię o pomoc.</p>
      ) : (
        <ul className="max-w-3xl border-t">
          {reports.map((r) => (
            <li key={r.code} className="space-y-1 border-b py-5">
              <p>
                <Link href={`/ekspert/${r.code}`} className={linkClass}>
                  {r.kind === "pomysl" ? "Pomysł" : "Zgłoszenie"} {r.code}
                </Link>
                <span className="text-muted-foreground">
                  {" · "}{NEED_STATUS_LABELS[r.status as NeedStatus] ?? r.status}{r.gmina && ` · ${r.gmina}`} · {formatDate(r.updatedAt)}
                </span>
              </p>
              {r.summary && <p className="max-w-[68ch]">{r.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
