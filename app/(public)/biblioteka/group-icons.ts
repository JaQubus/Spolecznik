import {
  Accessibility,
  Armchair,
  Baby,
  BriefcaseBusiness,
  Ear,
  HandHelping,
  House,
  Languages,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { GROUPS } from "@/lib/schemas";

/** Ikona przy każdej kategorii „dla kogo” — zawsze obok tekstu, nigdy zamiast niego. */
export const GROUP_ICONS: Record<(typeof GROUPS)[number], LucideIcon> = {
  seniorzy: Armchair,
  dzieci_mlodziez_rodzina: Baby,
  ograniczona_mobilnosc: Accessibility,
  niepelnosprawnosc_sensoryczna: Ear,
  zdrowie_medycyna: Stethoscope,
  rynek_pracy: BriefcaseBusiness,
  cudzoziemcy: Languages,
  bezdomnosc: House,
  niepelnosprawnosc_intelektualna: HandHelping,
};
