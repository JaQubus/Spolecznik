"use client";

import { useRouter } from "next/navigation";
import { UnitSearch } from "@/components/knowledge/unit-search";
import type { MapUnit } from "@/lib/knowledge/map";

/** Druga linijka przy nazwie — w Małopolsce są pary gmin o tej samej nazwie (np. Bochnia miejska i wiejska). */
const gminaDetails = (u: MapUnit) =>
  u.parent ? `gmina ${u.kind ?? ""}, ${u.parent.replace(/ \(miasto na prawach powiatu\)$/, "")}` : null;

/** „Znajdź gminę”: wybór otwiera raport gminy. */
export function GminaPicker({ units }: { units: Pick<MapUnit, "id" | "name" | "parent" | "kind">[] }) {
  const router = useRouter();
  return (
    <UnitSearch
      id="raport-gmina"
      label="Znajdź gminę"
      units={units as MapUnit[]}
      describe={gminaDetails}
      className="max-w-xl"
      onSelect={(id) => id && router.push(`/biblioteka/gmina/${id}`)}
    />
  );
}
