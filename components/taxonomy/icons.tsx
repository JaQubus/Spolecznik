import {
  AcademicCapIcon, BeakerIcon, BookOpenIcon, BriefcaseIcon, BuildingLibraryIcon, BuildingOffice2Icon, BuildingOfficeIcon,
  ChatBubbleLeftRightIcon, ClipboardDocumentListIcon, ComputerDesktopIcon, CubeIcon, DevicePhoneMobileIcon,
  DocumentChartBarIcon, FilmIcon, GlobeAltIcon, GlobeEuropeAfricaIcon, HeartIcon, HomeModernIcon, LifebuoyIcon, LightBulbIcon,
  MapIcon, MusicalNoteIcon, NewspaperIcon, PencilSquareIcon, PlusCircleIcon, RocketLaunchIcon, ShareIcon, Squares2X2Icon,
  TruckIcon, UserGroupIcon, UsersIcon, WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { cn } from "cn";
import type { ComponentType, SVGProps } from "react";
import { Badge } from "@/components/ui/badge";
import type { InnovationType, MaterialKind } from "@/lib/knowledge/types";
import { domainLabel, type DomainKey, type InstitutionKey, type StageKey } from "@/lib/taxonomy";

// Ikony Heroicons (outline, 24 px). Zawsze stoją obok tekstu, więc są dekoracyjne (aria-hidden).
export type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export const DOMAIN_ICONS: Record<DomainKey, Icon> = {
  edukacja: AcademicCapIcon,
  nauka: BeakerIcon,
  cyfryzacja: ComputerDesktopIcon,
  administracja: BuildingOfficeIcon,
  srodowisko: GlobeEuropeAfricaIcon,
  zdrowie: PlusCircleIcon,
  uslugi_spoleczne: HeartIcon,
  mobilnosc: TruckIcon,
  kultura: MusicalNoteIcon,
  gospodarka: BriefcaseIcon,
  partycypacja: ChatBubbleLeftRightIcon,
};

export const INSTITUTION_ICONS: Record<InstitutionKey, Icon> = {
  szkola_podstawowa: BookOpenIcon,
  szkola_ponadpodstawowa: WrenchScrewdriverIcon,
  uczelnia: AcademicCapIcon,
  gmina: HomeModernIcon,
  powiat: BuildingOffice2Icon,
  kultura: BuildingLibraryIcon,
  pomoc_zdrowie: LifebuoyIcon,
  inna: UsersIcon,
};

export const STAGE_ICONS: Record<StageKey, Icon> = {
  pomysl: LightBulbIcon,
  pilotaz: PencilSquareIcon,
  dziala: RocketLaunchIcon,
  przeniesiona: ShareIcon,
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
  strona: GlobeAltIcon,
};

/**
 * Ikona dziedziny na kółku w kolorze dziedziny (data-domain w app/globals.css).
 * className ustala rozmiar kółka, iconClassName rozmiar ikony.
 */
export function DomainIcon({ domain, className, iconClassName }: { domain: string; className?: string; iconClassName?: string }) {
  const Icon = DOMAIN_ICONS[domain as DomainKey] ?? BookOpenIcon;
  return (
    <span aria-hidden data-domain={domain} className={cn("flex shrink-0 items-center justify-center rounded-full bg-domain-soft text-domain", className)}>
      <Icon className={iconClassName} />
    </span>
  );
}

/** Etykieta dziedziny: miękkie tło i ikona w kolorze dziedziny, tekst zawsze w kolorze tekstu. */
export function DomainBadge({ domain }: { domain: string }) {
  const Icon = DOMAIN_ICONS[domain as DomainKey];
  return (
    <Badge data-domain={domain} className="bg-domain-soft">
      {Icon && <Icon aria-hidden className="text-domain" />}
      {domainLabel(domain)}
    </Badge>
  );
}
