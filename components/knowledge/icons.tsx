import {
  BanknotesIcon, BookOpenIcon, BriefcaseIcon, ClipboardDocumentListIcon, CubeIcon, DevicePhoneMobileIcon,
  DocumentChartBarIcon, EyeIcon, FilmIcon, HandRaisedIcon, HeartIcon, HomeIcon, LanguageIcon, LifebuoyIcon,
  MapIcon, MapPinIcon, NewspaperIcon, PlusCircleIcon, Squares2X2Icon, UserGroupIcon, UsersIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import type { AreaKey, GroupKey, InnovationType, MaterialKind } from "@/lib/knowledge/types";

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

/** Ikona obszaru po kluczu (areas.icon w bazie trzymał nazwę ikony Lucide — dziś decyduje klucz obszaru). */
export function AreaIcon({ area, className }: { area: string; className?: string }) {
  const Icon = AREA_ICONS[area as AreaKey] ?? BookOpenIcon;
  return <Icon aria-hidden className={className} />;
}
