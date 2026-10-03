import {
  Accessibility, BookOpen, Brain, Briefcase, Ear, FileText, HandCoins, HandHelping, HeartHandshake, HeartPulse,
  House, HouseHeart, Languages, LayoutGrid, Newspaper, Package, Signpost, Smartphone, Stethoscope, Users, Video,
  Workflow, type LucideIcon,
} from "lucide-react";
import type { GroupKey, InnovationType, MaterialKind } from "@/lib/knowledge/types";

// Nazwy ikon z bazy (areas.icon) → komponenty Lucide. Ikony zawsze stoją obok tekstu, więc są dekoracyjne.
const BY_NAME: Record<string, LucideIcon> = {
  Accessibility, BookOpen, Brain, Briefcase, Ear, HandCoins, HeartHandshake, HeartPulse, House, HouseHeart,
  Languages, Stethoscope, Users,
};

export const GROUP_ICONS: Record<GroupKey, LucideIcon> = {
  seniorzy: HeartHandshake,
  dzieci_mlodziez_rodzina: Users,
  ograniczona_mobilnosc: Accessibility,
  niepelnosprawnosc_sensoryczna: Ear,
  zdrowie_medycyna: Stethoscope,
  rynek_pracy: Briefcase,
  cudzoziemcy: Languages,
  bezdomnosc: House,
  niepelnosprawnosc_intelektualna: BookOpen,
};

export const TYPE_ICONS: Record<InnovationType, LucideIcon> = {
  przedmiot: Package,
  metoda: Workflow,
  usluga: HandHelping,
  technologia: Smartphone,
};

export const MATERIAL_ICONS: Record<MaterialKind, LucideIcon> = {
  raport: FileText,
  poradnik: Signpost,
  film: Video,
  kanwa: LayoutGrid,
  publikacja: Newspaper,
};

export function NamedIcon({ name, className }: { name: string; className?: string }) {
  const Icon = BY_NAME[name] ?? BookOpen;
  return <Icon aria-hidden className={className} />;
}
