import Link from "next/link";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { needTimeline, type NeedStatus } from "@/lib/need-status";
import { needHistory, statusEvents } from "@/lib/panel/needs";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Status zgłoszenia" };

const CODE = /^SPL-[2-9A-HJ-NP-Z]{4}$/;
const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

export default async function Page(props: PageProps<"/status/[kod]">) {
  const { kod } = await props.params;
  const code = decodeURIComponent(kod).trim().toUpperCase();

  // Bez logowania: zgłoszenie znajdujemy po kodzie przez service_role i pokazujemy tylko
  // zanonimizowane streszczenie i status — nigdy surowej treści.
  const { data: need, error } = CODE.test(code)
    ? await createAdminClient()
        .from("needs")
        .select("id, status, created_at, card->>summary")
        .eq("status_code", code)
        .maybeSingle()
    : { data: null, error: null };
  if (error) throw error;

  if (!need) {
    return (
      <section className="max-w-[68ch] space-y-4">
        <h1 className="text-3xl font-bold">Nie znaleźliśmy zgłoszenia o kodzie <span className="font-mono tracking-wider">{code}</span></h1>
        <p>Sprawdź, czy kod jest przepisany dokładnie. Wygląda tak: <span className="font-mono">SPL-4K7Q</span>.</p>
        <p><Link href="/status" className={linkClass}>Wpisz kod jeszcze raz</Link></p>
      </section>
    );
  }

  const events = statusEvents(await needHistory(need.id));
  const steps = needTimeline(need.created_at, need.status as NeedStatus, events);

  return (
    <section className="max-w-[68ch] space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Status zgłoszenia</h1>
        <p className="text-lg">Kod: <strong className="font-mono text-2xl tracking-wider">{code}</strong></p>
        {need.summary && <p><strong>Twoje zgłoszenie:</strong> {need.summary}</p>}
      </div>
      <StatusTimeline steps={steps} />
    </section>
  );
}
