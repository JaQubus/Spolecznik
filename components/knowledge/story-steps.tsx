import Link from "next/link";
import { formatNumber, plural } from "@/lib/pl";
import { brand } from "@/lib/brand";

/** Tekst z opisu: akapity po nowych liniach, wiersze z „•” jako lista. */
export function Prose({ text }: { text: string }) {
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

export type Story = {
  problem: string | null;
  beneficiaries?: string | null;
  solution: string | null;
  components?: string | null;
  evidence: string | null;
  howToUse: string | null;
  whoCanUse?: string | null;
  adoptionsCount: number;
  avgRating: number | null;
  /** ?inicjatywa=… albo ?rozwiazanie=… — link do „Wypróbowaliśmy u nas” i „Przenieś do siebie”. */
  sourceParam: string;
};

/**
 * Inicjatywa albo rozwiązanie jako historia w 4 krokach: problem → rozwiązanie → efekty → jak przenieść.
 * Kroki to <ol> z nagłówkami h2, więc czytnik ekranu ogłasza „lista, 4 elementy” i można skakać po nagłówkach.
 */
export function StorySteps({ story: s }: { story: Story }) {
  const n = s.adoptionsCount;
  // Wyniki z „Wypróbowaliśmy u nas” wracają tutaj. Przy zerze mówimy to wprost i zapraszamy do przeniesienia,
  // zamiast milczeć — brak zdania wyglądałby jak brak takiej możliwości.
  const adoptionsLine = n > 0
    ? `Przeniesiono ją już w ${n} ${plural(n, "miejscu", "miejscach", "miejscach")}${s.avgRating != null ? `, średnia ocena ${formatNumber(s.avgRating)} na 5` : ""}.`
    : (
      <>
        Nikt jeszcze nie zgłosił w {brand.nameLocative}, że ją przeniósł.{" "}
        <Link href={`/wyprobuj?${s.sourceParam}`} className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
          Wypróbowaliście ją u siebie? Daj znać
        </Link>
      </>
    );
  const steps = [
    { title: "Jaki problem rozwiązuje", body: s.problem, extra: s.beneficiaries && { label: "Dla kogo", text: s.beneficiaries } },
    { title: "Na czym polega", body: s.solution, extra: s.components && { label: "Z czego się składa", text: s.components } },
    { title: "Co już dała", body: s.evidence ?? "Autor nie opisał jeszcze efektów.", note: adoptionsLine },
    s.howToUse
      ? { title: "Jak przenieść ją do siebie", body: s.howToUse, extra: s.whoCanUse && { label: "Kto może to zrobić", text: s.whoCanUse } }
      : { title: "Jak przenieść ją do siebie", body: s.whoCanUse ?? null },
  ];
  return (
    <ol className="space-y-10">
      {steps.map((step, i) => (
        <li key={step.title} className="grid gap-x-5 gap-y-3 sm:grid-cols-[3rem_1fr]">
          <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-foreground text-xl font-bold text-background">
            {i + 1}
          </span>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">
              <span className="sr-only">Krok {i + 1}: </span>{step.title}
            </h2>
            {step.body ? <Prose text={step.body} /> : <p>Brak opisu.</p>}
            {"note" in step && step.note && <p className="max-w-[44rem]">{step.note}</p>}
            {step.extra && (
              <div className="max-w-[44rem]">
                <h3 className="text-lg font-bold">{step.extra.label}</h3>
                <Prose text={step.extra.text} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
