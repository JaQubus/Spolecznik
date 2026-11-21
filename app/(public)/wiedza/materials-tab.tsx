import Form from "next/form";
import { MaterialList } from "@/components/knowledge/material-list";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { knowledge } from "@/lib/knowledge";
import { MATERIAL_KIND_LABELS } from "@/lib/knowledge/labels";
import { MATERIAL_KINDS, type AreaKey, type MaterialKind } from "@/lib/knowledge/types";
import { plural } from "@/lib/pl";
import { MWS_AREAS } from "@/lib/schemas";
import { AREA_LABELS } from "@/lib/taxonomy";

export function parseMaterialParams(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const kind = one("rodzaj");
  const area = one("obszar");
  return {
    kind: (MATERIAL_KINDS as readonly string[]).includes(kind) ? (kind as MaterialKind) : undefined,
    area: (MWS_AREAS as readonly string[]).includes(area) ? (area as AreaKey) : undefined,
  };
}

/** Materiały edukacyjne: raporty, poradniki, filmy, kanwa i publikacje. */
export async function MaterialsTab({ params: p }: { params: ReturnType<typeof parseMaterialParams> }) {
  const items = await knowledge.materials(p);
  const n = items.length;
  return (
    <section aria-labelledby="materialy-naglowek" className="space-y-8">
      <h2 id="materialy-naglowek" className="text-3xl font-bold">Materiały</h2>
      <p className="max-w-[44rem] text-lg">
        Raporty, poradniki i filmy o innowacjach społecznych i problemach, które rozwiązują. Wszystkie są bezpłatne.
      </p>
      <Form action="/biblioteka" scroll={false} className="flex flex-col gap-6 rounded-[16px] bg-secondary p-5 md:flex-row md:items-end">
        <input type="hidden" name="tab" value="materials" />
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="filtr-rodzaj">Rodzaj materiału</Label>
          <NativeSelect id="filtr-rodzaj" name="rodzaj" defaultValue={p.kind ?? ""}>
            <option value="">Wszystkie rodzaje</option>
            {MATERIAL_KINDS.map((k) => <option key={k} value={k}>{MATERIAL_KIND_LABELS[k]}</option>)}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="filtr-material-obszar">Obszar</Label>
          <NativeSelect id="filtr-material-obszar" name="obszar" defaultValue={p.area ?? ""}>
            <option value="">Wszystkie obszary</option>
            {MWS_AREAS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">Pokaż materiały</Button>
      </Form>
      <p role="status" className="text-lg font-bold">
        {n === 0 ? "Brak materiałów dla wybranych filtrów." : `Znaleziono ${n} ${plural(n, "materiał", "materiały", "materiałów")}.`}
      </p>
      <MaterialList items={items} />
    </section>
  );
}
