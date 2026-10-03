import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NEED_STATUS_LABELS } from "@/lib/need-status";
import { formatDate } from "@/lib/pl";
import type { MyNeed } from "@/lib/threads";

const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/**
 * „Twoje zgłoszenia na tym urządzeniu” (ciasteczko z lib/need-access.ts) — dla kogoś, kto zapomniał kodu.
 * `primary` to akcja strony, na której jest lista (przycisk); druga akcja to zwykły link.
 */
export function MyNeeds({ mine, primary }: { mine: MyNeed[]; primary: "rozmowa" | "status" }) {
  return (
    <section aria-labelledby="moje-zgloszenia" className="max-w-3xl space-y-3">
      <h2 id="moje-zgloszenia" className="text-2xl font-bold">Twoje zgłoszenia na tym urządzeniu</h2>
      {mine.length === 0 ? (
        <p className="text-muted-foreground">
          Ta przeglądarka nie pamięta żadnego zgłoszenia. Jeśli masz prywatny link do rozmowy, po prostu go otwórz.
        </p>
      ) : (
        <ul className="border-t">
          {mine.map((n) => {
            const conversation = { href: `/zapytaj?potrzeba=${n.code}`, label: "Otwórz rozmowę" };
            const status = { href: `/status/${n.code}`, label: "Zobacz status" };
            const [main, other] = primary === "rozmowa" ? [conversation, status] : [status, conversation];
            return (
              <li key={n.code} className="flex flex-wrap items-center justify-between gap-3 border-b py-4">
                <div className="min-w-0 flex-1 basis-64 space-y-1">
                  <p>
                    <span className="font-mono font-bold tracking-wider">{n.code}</span>
                    <span className="text-muted-foreground"> · {formatDate(n.createdAt)} · {NEED_STATUS_LABELS[n.status]}</span>
                  </p>
                  {n.summary && <p className="line-clamp-2">{n.summary}</p>}
                  <p>
                    <Link href={other.href} className={linkClass} aria-label={`${other.label}: zgłoszenie ${n.code}`}>
                      {other.label}
                    </Link>
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={main.href} aria-label={`${main.label}: zgłoszenie ${n.code}`}>{main.label}</Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
