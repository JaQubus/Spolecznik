import Link from "next/link";
import { AreaList } from "@/components/knowledge/tiles";
import { flags } from "@/lib/flags";
import { knowledge } from "@/lib/knowledge";

/** „Wyzwania Małopolski”: główne tematy jako lista obszarów; każdy prowadzi do strony obszaru z liczbami i innowacjami. */
export async function ChallengesTab() {
  const areas = await knowledge.areas();
  return (
    <section aria-label="Wyzwania Małopolski" className="space-y-8">
      <p className="max-w-[70rem] text-lg">
        Najważniejsze problemy społeczne w regionie. Wybierz temat, żeby zobaczyć liczby ze źródłami i sprawdzone rozwiązania.
      </p>
      {flags.mojaGmina && (
        <p><Link href="/moja-gmina" className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">Zobacz dane swojej gminy</Link></p>
      )}
      <AreaList areas={areas} />
    </section>
  );
}
