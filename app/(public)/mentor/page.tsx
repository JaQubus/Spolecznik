import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { statusLabel } from "@/lib/initiatives/status";
import { assignedInitiatives, requireMentor } from "@/lib/mentors";
import { formatDate } from "@/lib/pl";
import { org } from "@/lib/brand";

export const metadata = { title: "Moje inicjatywy · Mentor" };

const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/** Wejście dla mentora: tylko inicjatywy, przy których zespół poprosił go o pomoc. */
export default async function Page() {
  const { mentor } = await requireMentor();
  if (!mentor) {
    return (
      <section className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold">Inicjatywy do wsparcia</h1>
        <Alert title="Nie znaleźliśmy Twojego profilu mentora">
          <p>Poproś zespół {org.short} o dopisanie Cię do bazy mentorów. Do tego czasu nie możemy pokazać przypisanych inicjatyw.</p>
        </Alert>
      </section>
    );
  }
  const items = await assignedInitiatives(mentor.id);

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Inicjatywy do wsparcia</h1>
        <p className="max-w-2xl text-lg">
          Jesteś zalogowany jako <strong>{mentor.name}</strong>. Tu są inicjatywy, przy których zespół {org.short} prosi Cię
          o pomoc. Odpowiadasz bezpośrednio autorowi; zespół widzi rozmowę.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-lg">Nie masz jeszcze przypisanych inicjatyw. Damy znać w powiadomieniach, gdy zespół poprosi Cię o pomoc.</p>
      ) : (
        <ul className="max-w-3xl border-t">
          {items.map((r) => (
            <li key={r.code} className="space-y-1 border-b py-5">
              <p>
                <Link href={`/mentor/${r.code}`} className={linkClass}>{r.title}</Link>
                <span className="text-muted-foreground">
                  {" · "}<span className="font-mono">{r.code}</span> · {statusLabel(r.status)}{r.gmina && ` · ${r.gmina}`} · {formatDate(r.updatedAt)}
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
