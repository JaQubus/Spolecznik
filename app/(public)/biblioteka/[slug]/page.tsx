import { CirclePlay, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInnovation, type Innovation } from "@/lib/library";
import { formatNumber, plural } from "@/lib/pl";
import { AREA_LABELS, GROUP_LABELS } from "@/lib/taxonomy";

const linkClass = "inline-flex items-center gap-2 font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

export async function generateMetadata(props: PageProps<"/biblioteka/[slug]">) {
  const { slug } = await props.params;
  const innovation = await getInnovation(slug).catch(() => null);
  return { title: innovation?.title ?? "Rozwiązanie" };
}

/** Historia w 4 krokach — mapuje się 1:1 na sekcje stron Biblioteki ROPS (README §6, Wiedza). */
function storySteps(i: Innovation): { title: string; body: string | null }[] {
  return [
    { title: "Jaki był problem", body: i.problem },
    { title: "Co zrobiono", body: [i.solution, i.components && `Składowe: ${i.components}`].filter(Boolean).join("\n\n") || null },
    { title: "Skąd wiemy, że działa", body: i.evidence },
    { title: "Jak skorzystać", body: [i.howToUse, i.whoCanUse && `Kto może wdrożyć: ${i.whoCanUse}`].filter(Boolean).join("\n\n") || null },
  ];
}

export default async function Page(props: PageProps<"/biblioteka/[slug]">) {
  const { slug } = await props.params;
  let innovation: Innovation | null;
  try {
    innovation = await getInnovation(decodeURIComponent(slug));
  } catch (e) {
    console.error("[biblioteka/slug]", e);
    return (
      <section className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Rozwiązanie</h1>
        <Alert tone="error" title="Nie udało się pobrać rozwiązania">
          <p>Spróbuj ponownie za kilka minut.</p>
        </Alert>
      </section>
    );
  }
  if (!innovation) notFound();
  const i = innovation;
  const tags = [...i.targetGroups.map((g) => GROUP_LABELS[g as keyof typeof GROUP_LABELS]), ...i.areas.map((a) => AREA_LABELS[a as keyof typeof AREA_LABELS])]
    .filter(Boolean)
    .slice(0, 3);

  return (
    <article className="space-y-10">
      <header className="space-y-4">
        <p className="text-base">
          <Link href="/biblioteka" className="underline decoration-1 underline-offset-4 hover:decoration-2">Biblioteka</Link>
          {i.category && <span className="text-muted-foreground"> · {i.category}</span>}
        </p>
        <h1 className="text-3xl font-bold">{i.title}</h1>
        {i.synthetic && (
          <Alert title="To przykład do pokazu">
            <p>Ten opis jest przykładowy (dane demonstracyjne), nie pochodzi z Biblioteki ROPS.</p>
          </Alert>
        )}
        {/* W trybie prostym streszczenie łatwe do czytania jest głównym tekstem. */}
        {i.etrSummary && <p className="max-w-[68ch] text-xl simple:text-2xl">{i.etrSummary}</p>}
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-2 simple:hidden" aria-label="Dla kogo i obszary">
            {tags.map((t) => <li key={t}><Badge>{t}</Badge></li>)}
          </ul>
        )}
        {i.testsCount > 0 && (
          <p className="text-base text-muted-foreground">
            Przetestowano {i.testsCount} {plural(i.testsCount, "raz", "razy", "razy")}
            {i.avgRating != null && `, średnia ocena ${formatNumber(i.avgRating)} na 5`}.
          </p>
        )}
      </header>

      <ol className="max-w-[68ch] space-y-8">
        {storySteps(i).map((s, n) => (
          <li key={s.title} className="space-y-2">
            <h2 className="text-2xl font-bold"><span className="text-muted-foreground">{n + 1}.</span> {s.title}</h2>
            {s.body
              ? s.body.split(/\n{2,}/).map((p, k) => <p key={k}>{p}</p>)
              : <p className="text-muted-foreground">Brak opisu w Bibliotece.</p>}
          </li>
        ))}
      </ol>

      {(i.videoUrl || i.pdfUrl || i.sourceUrl) && (
        <ul className="space-y-2">
          {i.videoUrl && (
            <li><a href={i.videoUrl} target="_blank" rel="noreferrer" className={linkClass}>
              <CirclePlay aria-hidden className="size-5" /> Obejrzyj film<span className="sr-only"> (otwiera się w nowej karcie)</span>
            </a></li>
          )}
          {i.pdfUrl && (
            <li><a href={i.pdfUrl} target="_blank" rel="noreferrer" className={linkClass}>
              <ExternalLink aria-hidden className="size-5" /> Karta rozwiązania (PDF)<span className="sr-only"> (otwiera się w nowej karcie)</span>
            </a></li>
          )}
          {i.sourceUrl && (
            <li><a href={i.sourceUrl} target="_blank" rel="noreferrer" className={linkClass}>
              <ExternalLink aria-hidden className="size-5" /> Opis w Bibliotece ROPS<span className="sr-only"> (otwiera się w nowej karcie)</span>
            </a></li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild><Link href={`/wdrozenie?innowacja=${i.id}`}>Jak to wdrożyć u nas?</Link></Button>
        <Button asChild variant="outline"><Link href={`/przetestuj?innowacja=${i.id}`}>Chcę przetestować</Link></Button>
      </div>
    </article>
  );
}
