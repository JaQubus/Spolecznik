import {
  AcademicCapIcon, BanknotesIcon, BookOpenIcon, BriefcaseIcon, BuildingOffice2Icon, GlobeEuropeAfricaIcon, HeartIcon,
  HomeIcon, LifebuoyIcon, PlusCircleIcon, UsersIcon,
} from "@heroicons/react/24/outline";

/** Kategorie wskaźników mapy (klucze z data/map_indicators.py) — ikona zawsze obok nazwy. */
export const MAP_CATEGORIES: { key: string; label: string; Icon: typeof UsersIcon }[] = [
  { key: "ludnosc", label: "Ludność", Icon: UsersIcon },
  { key: "seniorzy", label: "Seniorzy i opieka", Icon: HeartIcon },
  { key: "pomoc", label: "Pomoc społeczna", Icon: LifebuoyIcon },
  { key: "placowki", label: "Placówki i kadra", Icon: BuildingOffice2Icon },
  { key: "rodzina", label: "Rodzina i dzieci", Icon: HomeIcon },
  { key: "praca", label: "Praca i gospodarka", Icon: BriefcaseIcon },
  { key: "edukacja", label: "Edukacja", Icon: AcademicCapIcon },
  { key: "zdrowie", label: "Zdrowie", Icon: PlusCircleIcon },
  { key: "kultura", label: "Kultura i sport", Icon: BookOpenIcon },
  { key: "finanse", label: "Budżety gmin", Icon: BanknotesIcon },
  { key: "otoczenie", label: "Mieszkania i otoczenie", Icon: GlobeEuropeAfricaIcon },
];
