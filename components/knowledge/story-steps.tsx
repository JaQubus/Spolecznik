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
};

/**
 * Inicjatywa jako historia w 3 krokach: problem → rozwiązanie → efekty.
 * Kroki to <ol> z nagłówkami h2, więc czytnik ekranu ogłasza „lista, 4 elementy” i można skakać po nagłówkach.
 */
export function StorySteps({ story: s }: { story: Story }) {
  const steps = [
    { title: "Jaki problem rozwiązuje", body: s.problem, extra: s.beneficiaries && { label: "Dla kogo", text: s.beneficiaries } },
    { title: "Na czym polega", body: s.solution, extra: s.components && { label: "Z czego się składa", text: s.components } },
    { title: "Co już dała", body: s.evidence ?? "Autor nie opisał jeszcze efektów." },
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
