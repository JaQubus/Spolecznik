import Link from "next/link";
import type { Innovation } from "@/lib/knowledge/types";
import { formatNumber, plural } from "@/lib/pl";

/** Tekst ze strony ROPS: akapity po nowych liniach, wiersze z „•” jako lista. */
function Prose({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks: (string | string[])[] = [];
  for (const line of lines) {
    if (line.startsWith("•")) {
      const item = line.replace(/^•\s*/, "");
      const last = blocks.at(-1);
      if (Array.isArray(last)) last.push(item);
      else blocks.push([item]);
    } else blocks.push(line);
  }
  return (
    <div className="max-w-[44rem] space-y-3">
      {blocks.map((b, n) =>
        Array.isArray(b)
          ? <ul key={n} className="list-disc space-y-1 pl-6">{b.map((i) => <li key={i}>{i}</li>)}</ul>
          : <p key={n}>{b}</p>,
      )}
    </div>
  );
}

/**
 * Innowacja jako historia w 4 krokach — odpowiadają stałym sekcjom stron Biblioteki ROPS.
 * Kroki to <ol> z nagłówkami h2, więc czytnik ekranu ogłasza „lista, 4 elementy” i można skakać po nagłówkach.
 */
export function StorySteps({ innovation: i }: { innovation: Innovation }) {
  const tests = i.testsCount ?? 0;
  // Wyniki z Próby (/przetestuj) wracają tutaj. Przy zerze testów mówimy to wprost i zapraszamy do testu,
  // zamiast milczeć — brak zdania wyglądałby jak brak takiej możliwości.
  const testsLine = tests > 0
    ? `W Społeczniku przetestowano ją ${tests} ${plural(tests, "raz", "razy", "razy")}${i.avgRating != null ? `, średnia ocena ${formatNumber(i.avgRating)} na 5` : ""}.`
    : (
      <>
        W Społeczniku nikt jeszcze jej nie przetestował.{" "}
        <Link href={`/przetestuj?innowacja=${i.slug ?? i.id}`} className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
          Przetestuj ją u siebie i oceń
        </Link>
      </>
    );
  const steps = [
    { title: "Jaki problem rozwiązuje", body: i.problem, extra: i.beneficiaries && { label: "Dla kogo", text: i.beneficiaries } },
    { title: "Na czym polega rozwiązanie", body: i.solution, extra: i.components && { label: "Z czego się składa", text: i.components } },
    { title: "Skąd wiemy, że działa", body: i.evidence ?? "ROPS nie opisał jeszcze wyników testu tej innowacji.", note: testsLine },
    // Dwa różne pola (z karty PDF i ze strony ROPS) — każde ze swoją etykietą, gdy są oba.
    i.howToUse
      ? { title: "Jak skorzystać i kto może to wdrożyć", body: i.howToUse, extra: i.whoCanUse && { label: "Kto może to wdrożyć", text: i.whoCanUse } }
      : { title: "Jak skorzystać i kto może to wdrożyć", body: i.whoCanUse },
  ];
  return (
    <ol className="space-y-10">
      {steps.map((s, n) => (
        <li key={s.title} className="grid gap-x-5 gap-y-3 sm:grid-cols-[3rem_1fr]">
          <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-foreground text-xl font-bold text-background">
            {n + 1}
          </span>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">
              <span className="sr-only">Krok {n + 1}: </span>{s.title}
            </h2>
            {s.body ? <Prose text={s.body} /> : <p>Brak opisu.</p>}
            {"note" in s && s.note && <p className="max-w-[44rem]">{s.note}</p>}
            {s.extra && (
              <div className="max-w-[44rem]">
                <h3 className="text-lg font-bold">{s.extra.label}</h3>
                <Prose text={s.extra.text} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
