import { plural } from "@/lib/pl";
import type { Innovation, Persona } from "@/lib/knowledge/types";
import { InnovationTiles } from "./tiles";

/** „Poznaj: Janina” — fikcyjna persona z Mapy Wyzwań i innowacje, które mogą jej pomóc. */
export function PersonaStory({ persona: p, innovations }: { persona: Persona; innovations: Innovation[] }) {
  const id = `persona-${p.key}`;
  return (
    <section aria-labelledby={id} className="full-bleed space-y-6 bg-secondary py-10">
      <div className="space-y-2">
        <h2 id={id} className="text-2xl font-bold">
          Poznaj: {p.name}{p.age && `, ${p.age} ${plural(p.age, "rok", "lata", "lat")}`}
        </h2>
        <p className="text-base text-muted-foreground">
          To postać wymyślona przez ROPS w Mapie Wyzwań Społecznych. Pokazuje, jak problem wygląda w życiu.
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Kim jest</h3>
          <ul className="list-disc space-y-1 pl-6">{p.about.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Czego potrzebuje</h3>
          <ul className="list-disc space-y-1 pl-6">{p.needs.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      </div>
      {innovations.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Co może pomóc (propozycja do sprawdzenia przez eksperta)</h3>
          <InnovationTiles items={innovations} />
        </div>
      ) : (
        p.gap && <p className="max-w-[44rem] text-lg"><strong>Luka w bibliotece:</strong> {p.gap}</p>
      )}
    </section>
  );
}
