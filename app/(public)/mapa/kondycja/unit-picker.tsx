"use client";

import { useRouter } from "next/navigation";
import { UnitSearch } from "@/components/knowledge/unit-search";
import type { LayerKey, MapUnit } from "@/lib/knowledge/map";

/** Druga linijka przy nazwie gminy — w Małopolsce są pary gmin o tej samej nazwie (np. Bochnia miejska i wiejska). */
const gminaDetails = (u: MapUnit) =>
  u.parent ? `gmina ${u.kind ?? ""}, ${u.parent.replace(/ \(miasto na prawach powiatu\)$/, "")}` : null;
const noDetails = () => null;

/** „Znajdź gminę / powiat”: wybór otwiera kartę terytorium. Dla klawiatury i czytnika to główna droga do gminy. */
export function UnitPicker({ layer, units, selected, query }: {
  layer: LayerKey;
  /** Jednostki bez granic i wartości — tylko to, czego potrzebują podpowiedzi. */
  units: Pick<MapUnit, "id" | "name" | "parent" | "kind">[];
  selected: string | null;
  /** Pozostałe parametry adresu (poziom, wskaźnik). */
  query: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <UnitSearch
      key={layer}
      id="kondycja-jednostka"
      label={layer === "gminy" ? "Znajdź gminę" : "Znajdź powiat"}
      units={units as MapUnit[]}
      describe={layer === "gminy" ? gminaDetails : noDetails}
      selected={selected ?? undefined}
      className="md:row-span-3 md:grid-rows-subgrid"
      onSelect={(id) => {
        const q = new URLSearchParams({ ...query, ...(id ? { id } : {}) });
        router.push(`/biblioteka/kondycja?${q}${id ? "#karta" : ""}`, { scroll: false });
      }}
    />
  );
}
