import { TrashIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/knowledge/breadcrumbs";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { knowledge } from "@/lib/knowledge";
import { canUseHybridSearch } from "@/lib/knowledge/indexing";
import { removeEntity } from "../../actions";
import { AreaForm, FactForm, InnovationForm, MaterialForm } from "../../forms";

export const metadata: Metadata = { title: "Edycja · Zarządzaj wiedzą", robots: { index: false } };

const KINDS = {
  innowacja: { list: "Innowacje", noun: "innowację", saved: "Zapisano. Innowacja będzie widoczna w wyszukiwarce za chwilę." },
  fakt: { list: "Fakty", noun: "fakt", saved: "Zapisano. Fakt jest już widoczny na stronie obszaru." },
  material: { list: "Materiały", noun: "materiał", saved: "Zapisano. Materiał będzie widoczny w wyszukiwarce za chwilę." },
  obszar: { list: "Opisy obszarów", noun: "obszar", saved: "Zapisano. Opis obszaru jest już widoczny." },
} as const;

export default async function Page(props: PageProps<"/panel/wiedza/[rodzaj]/[id]">) {
  const { rodzaj, id } = await props.params;
  if (!(rodzaj in KINDS)) notFound();
  const kind = rodzaj as keyof typeof KINDS;
  await requireAdmin(`/panel/wiedza/${kind}/${id}`);
  const isNew = id === "nowy";
  const saved = !!(await props.searchParams).zapisano;
  const all = { all: true };

  const [innovation, fact, material, area] = await Promise.all([
    kind === "innowacja" && !isNew ? knowledge.innovation(id, all) : null,
    kind === "fakt" && !isNew ? knowledge.facts(undefined, all).then((f) => f.find((x) => x.id === id) ?? null) : null,
    kind === "material" && !isNew ? knowledge.materials({}, all).then((m) => m.find((x) => x.id === id) ?? null) : null,
    kind === "obszar" ? knowledge.area(id, all) : null,
  ]);
  const record = innovation ?? fact ?? material ?? area;
  if ((!isNew && !record) || (isNew && kind === "obszar")) notFound();

  const name = innovation?.title ?? fact?.displayValue ?? material?.title ?? area?.name;
  const title = isNew ? `Dodaj ${KINDS[kind].noun}` : `Edytuj: ${name}`;
  const publicHref = innovation ? `/biblioteka/innowacja/${innovation.slug}` : area ? `/biblioteka/obszar/${area.slug}` : null;

  return (
    <section className="space-y-8">
      <Breadcrumbs items={[{ href: `/panel/wiedza?rodzaj=${kind}`, label: KINDS[kind].list }, { label: title }]} />
      <h1 className="text-3xl font-bold">{title}</h1>
      {saved && (
        <Alert tone="success" title="Zapisano">
          <p>{KINDS[kind].saved}{!canUseHybridSearch() && kind !== "fakt" && kind !== "obszar" && " W trybie bez bazy wyszukiwarka widzi zmianę od razu."}</p>
          {publicHref && (
            <p><Link href={publicHref} className="font-bold underline decoration-1 underline-offset-4">Zobacz, jak wygląda na stronie</Link></p>
          )}
        </Alert>
      )}

      {kind === "innowacja" && <InnovationForm innovation={innovation} />}
      {kind === "fakt" && <FactForm fact={fact} />}
      {kind === "material" && <MaterialForm material={material} />}
      {kind === "obszar" && area && <AreaForm area={area} />}

      {!isNew && kind !== "obszar" && record && (
        <section aria-labelledby="usun" className="max-w-[44rem] space-y-3 border-t border-border pt-8">
          <h2 id="usun" className="text-xl font-bold">Usuń</h2>
          <p>Usunięcia nie można cofnąć. Jeśli chcesz tylko schować rekord, odznacz „Opublikowane” i zapisz.</p>
          <form action={removeEntity}>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="outline"><TrashIcon aria-hidden />Usuń {KINDS[kind].noun}</Button>
          </form>
        </section>
      )}
    </section>
  );
}
