import { formatNumber } from "@/lib/pl";
import type { InnovationType, Material, MaterialKind } from "./types";

export const TYPE_LABELS: Record<InnovationType, string> = {
  przedmiot: "Przedmiot",
  metoda: "Metoda pracy",
  usluga: "Usługa",
  technologia: "Technologia",
};

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  raport: "Raport",
  poradnik: "Poradnik",
  film: "Film",
  kanwa: "Kanwa",
  publikacja: "Publikacja",
};

const LANGUAGE_LABELS: Record<string, string> = { pl: "po polsku", en: "po angielsku", uk: "po ukraińsku" };

export const languageLabel = (code: string) => LANGUAGE_LABELS[code] ?? code;

/** 1 843 113 → „1,8 MB” (jednostki dziesiętne, jak na stronach ROPS). */
export function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes) return null;
  const units = ["B", "kB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${formatNumber(value, value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Tekst linku materiału: czynność, tytuł i w nawiasie format, rozmiar oraz język. */
export function materialLinkText(m: Material): string {
  if (m.kind === "film") {
    const extras = ["film na YouTube", m.signLanguage && "z tłumaczeniem na polski język migowy", m.captions && "z napisami"];
    return `Obejrzyj: ${m.title} (${extras.filter(Boolean).join(", ")})`;
  }
  const details = [m.format, formatBytes(m.sizeBytes), languageLabel(m.language)].filter(Boolean).join(", ");
  return `Pobierz: ${m.title} (${details})`;
}

/** Plik powyżej 1 GB — ostrzegamy przed pobraniem (paczki materiałów ROPS mają do kilkudziesięciu GB). */
export const isHugeFile = (bytes: number | null | undefined) => (bytes ?? 0) >= 1_000_000_000;
