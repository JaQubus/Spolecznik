import {
  BanknotesIcon, BookOpenIcon, BriefcaseIcon, ClipboardDocumentListIcon, CubeIcon, DevicePhoneMobileIcon,
  DocumentChartBarIcon, EyeIcon, FilmIcon, HandRaisedIcon, HeartIcon, HomeIcon, LanguageIcon, LifebuoyIcon,
  MapIcon, MapPinIcon, NewspaperIcon, PlusCircleIcon, Squares2X2Icon, UserGroupIcon, UsersIcon,
} from "@heroicons/react/24/outline";
import { cn } from "cn";
import type { ComponentType, SVGProps } from "react";
import { Badge } from "@/components/ui/badge";
import type { AreaKey, GroupKey, InnovationType, MaterialKind } from "@/lib/knowledge/types";
import { AREA_LABELS } from "@/lib/taxonomy";

// Ikony Heroicons (outline, 24 px). Zawsze stoją obok tekstu, więc są dekoracyjne (aria-hidden).
// Heroicons nie ma ikon wózka, ucha ani mózgu — wybieramy najbliższe znaczeniowo, tekst mówi resztę.
export type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export const AREA_ICONS: Record<AreaKey, Icon> = {
  seniorzy: HeartIcon,
  niepelnosprawnosc: HandRaisedIcon,
  rodzina_piecza: UsersIcon,
  zdrowie_psychiczne: LifebuoyIcon,
  zdrowie: PlusCircleIcon,
  ubostwo: BanknotesIcon,
  bezdomnosc: HomeIcon,
  cudzoziemcy: LanguageIcon,
};

export const GROUP_ICONS: Record<GroupKey, Icon> = {
  seniorzy: HeartIcon,
  dzieci_mlodziez_rodzina: UsersIcon,
  ograniczona_mobilnosc: MapPinIcon,
  niepelnosprawnosc_sensoryczna: EyeIcon,
  zdrowie_medycyna: PlusCircleIcon,
  rynek_pracy: BriefcaseIcon,
  cudzoziemcy: LanguageIcon,
  bezdomnosc: HomeIcon,
  niepelnosprawnosc_intelektualna: BookOpenIcon,
};

export const TYPE_ICONS: Record<InnovationType, Icon> = {
  przedmiot: CubeIcon,
  metoda: ClipboardDocumentListIcon,
  usluga: UserGroupIcon,
  technologia: DevicePhoneMobileIcon,
};

export const MATERIAL_ICONS: Record<MaterialKind, Icon> = {
  raport: DocumentChartBarIcon,
  poradnik: MapIcon,
  film: FilmIcon,
  kanwa: Squares2X2Icon,
  publikacja: NewspaperIcon,
};

/** Grupa odbiorców nosi kolor najbliższego obszaru, żeby ten sam temat miał ten sam kolor w całym serwisie. */
export const GROUP_AREA: Record<GroupKey, AreaKey> = {
  seniorzy: "seniorzy",
  dzieci_mlodziez_rodzina: "rodzina_piecza",
  ograniczona_mobilnosc: "niepelnosprawnosc",
  niepelnosprawnosc_sensoryczna: "niepelnosprawnosc",
  zdrowie_medycyna: "zdrowie",
  rynek_pracy: "ubostwo",
  cudzoziemcy: "cudzoziemcy",
  bezdomnosc: "bezdomnosc",
  niepelnosprawnosc_intelektualna: "niepelnosprawnosc",
};

/**
 * Ikona obszaru po kluczu (areas.icon w bazie trzymał nazwę ikony Lucide — dziś decyduje klucz obszaru),
 * na kółku w kolorze obszaru. className ustala rozmiar kółka, iconClassName rozmiar ikony.
 */
export function AreaIcon({ area, className, iconClassName }: { area: string; className?: string; iconClassName?: string }) {
  const Icon = AREA_ICONS[area as AreaKey] ?? BookOpenIcon;
  return (
    <span aria-hidden data-area={area} className={cn("flex shrink-0 items-center justify-center rounded-full bg-area-soft text-area", className)}>
      <Icon className={iconClassName} />
    </span>
  );
}

/** Ikona grupy odbiorców w kolorze jej obszaru (GROUP_AREA). */
export function GroupIcon({ group, className }: { group: GroupKey; className?: string }) {
  const Icon = GROUP_ICONS[group];
  if (!Icon) return null;
  return <Icon aria-hidden data-area={GROUP_AREA[group]} className={cn("text-area", className)} />;
}

/** Etykieta obszaru: miękkie tło i ikona w kolorze obszaru, tekst zawsze w kolorze tekstu. */
export function AreaBadge({ area }: { area: string }) {
  const Icon = AREA_ICONS[area as AreaKey];
  return (
    <Badge data-area={area} className="bg-area-soft">
      {Icon && <Icon aria-hidden className="text-area" />}
      {AREA_LABELS[area as AreaKey] ?? area}
    </Badge>
  );
}
