"use client";

import {
  Accessibility, Armchair, Baby, Brain, Briefcase, Ear, Globe, HeartPulse, House, type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FilterChip } from "@/components/ui/chip";
import type { GROUPS } from "@/lib/schemas";
import { GROUP_LABELS } from "@/lib/taxonomy";

type Group = (typeof GROUPS)[number];

// Ikona zawsze obok tekstu (design system: Iconography).
const ICONS: Record<Group, LucideIcon> = {
  seniorzy: Armchair,
  dzieci_mlodziez_rodzina: Baby,
  ograniczona_mobilnosc: Accessibility,
  niepelnosprawnosc_sensoryczna: Ear,
  zdrowie_medycyna: HeartPulse,
  rynek_pracy: Briefcase,
  cudzoziemcy: Globe,
  bezdomnosc: House,
  niepelnosprawnosc_intelektualna: Brain,
};

/** Filtry „dla kogo”: jeden wybrany naraz, stan w adresie (?dla=…), więc link można wysłać dalej. */
export function GroupFilter({ current }: { current: Group | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(group: Group | null) {
    startTransition(() => router.push(group ? `/biblioteka?dla=${group}` : "/biblioteka", { scroll: false }));
  }

  return (
    <div role="group" aria-label="Dla kogo" aria-busy={pending} className="flex flex-wrap gap-2">
      <FilterChip pressed={current === null} onClick={() => pick(null)}>Wszystkie</FilterChip>
      {(Object.keys(ICONS) as Group[]).map((g) => {
        const Icon = ICONS[g];
        return (
          <FilterChip key={g} pressed={current === g} onClick={() => pick(current === g ? null : g)}>
            {current !== g && <Icon aria-hidden className="size-5" />}
            {GROUP_LABELS[g]}
          </FilterChip>
        );
      })}
    </div>
  );
}
