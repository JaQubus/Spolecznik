import { DomainList } from "@/components/knowledge/tiles";
import { knowledge } from "@/lib/knowledge";
import { region } from "@/lib/brand";

/** Dziedziny jako lista; każda prowadzi do strony z wyzwaniami regionu, liczbami ze źródłami i rozwiązaniami. */
export async function DomainsTab() {
  const domains = await knowledge.domains();
  return (
    <section aria-label="Dziedziny" className="space-y-8">
      <p className="max-w-[70rem] text-lg">
        Obszary, w których szukamy inicjatyw {region.locative}. Wybierz dziedzinę, żeby zobaczyć wyzwania regionu, liczby
        ze źródłami i sprawdzone rozwiązania.
      </p>
      <DomainList domains={domains} />
    </section>
  );
}
