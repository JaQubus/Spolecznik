import { SparklesIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { CLUSTER_MIN_SIZE } from "@/lib/knowledge/cluster-cards";
import { INITIATIVES_LIMIT, type Clusters } from "@/lib/knowledge/clusters";
import { plural } from "@/lib/pl";
import { domainLabel } from "@/lib/taxonomy";
import { ActionForm, SubmitButton } from "../action-form";
import { labelClustersAction } from "./actions";

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

/** Grupy podobnych inicjatyw: po wspólnych słowach kluczowych, z nazwą z LLM liczoną wsadowo. */
export function ClusterList({ data }: { data: Clusters }) {
  const { clusters, unlabeled, source, initiatives, capped } = data;
  return (
    <section aria-labelledby="grupy" className="space-y-6">
      <h2 id="grupy" className="text-2xl font-bold">Grupy podobnych inicjatyw</h2>
      <p className="max-w-[44rem] text-base text-muted-foreground">
        Inicjatywy, które mają co najmniej dwa wspólne słowa kluczowe, przy czym rzadkie słowa ważą więcej niż częste.
        Pokazujemy grupy od {CLUSTER_MIN_SIZE} inicjatyw. Nazwy grup tworzy AI na podstawie słów i kilku streszczeń. Zanim zaczniesz
        działać, sprawdź inicjatywy w grupie.
      </p>
      <p className="max-w-[44rem] text-base text-muted-foreground">
        {capped
          ? `Grupy liczymy z ${INITIATIVES_LIMIT} najnowszych inicjatyw — starsze nie są tu brane pod uwagę.`
          : `Grupy liczymy ze wszystkich inicjatyw (${initiatives}).`}
      </p>

      {unlabeled > 0 && (
        <ActionForm action={labelClustersAction} className="max-w-[44rem] space-y-3">
          <p>
            {unlabeled} {plural(unlabeled, "grupa nie ma", "grupy nie mają", "grup nie ma")} jeszcze nazwy.
            Nazwy liczymy na żądanie, raz dla każdej grupy, żeby nie zużywać limitu AI przy każdym wejściu na stronę.
          </p>
          <SubmitButton variant="outline" pendingText="Nazywanie grup…">
            <SparklesIcon aria-hidden className="size-5" />Nazwij nowe grupy
          </SubmitButton>
        </ActionForm>
      )}

      {clusters.length === 0 ? (
        <p className="text-muted-foreground">Za mało podobnych inicjatyw, żeby utworzyć grupy.</p>
      ) : (
        <ol className="max-w-[48rem] border-t">
          {clusters.map((c) => (
            <li key={c.signature} className="grid gap-2 border-b py-6">
              <h3 className="text-xl font-bold">{c.label ?? `Bez nazwy: ${c.keywords.slice(0, 3).join(", ")}`}</h3>
              {c.description && <p>{c.description}</p>}
              <p className="text-base text-muted-foreground">
                <strong className="text-foreground">{c.ids.length}</strong> {plural(c.ids.length, "inicjatywa", "inicjatywy", "inicjatyw")}
                {" · "}{c.gminy} {plural(c.gminy, "gmina", "gminy", "gmin")}
                {c.domains.length > 0 && ` · ${c.domains.map(domainLabel).join(", ")}`}
              </p>
              <p className="text-base">Wspólne słowa: {c.keywords.join(", ")}</p>
              {source === "baza" && (
                <p>
                  <Link href={`/panel?grupa=${c.key}`} className={`inline-flex min-h-12 items-center ${linkClass}`}>
                    Zobacz inicjatywy z grupy<span className="sr-only">: {c.label ?? c.keywords.join(", ")}</span>
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
