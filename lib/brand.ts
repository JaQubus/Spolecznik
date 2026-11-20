// Marka i region w jednym miejscu (config/brand.json — ten sam plik czyta pipeline: data/region.py).
// Bez "server-only" i bez aliasu @/: korzystają z tego proxy.ts, komponenty klienckie i testy jednostkowe (czysty Node).
import data from "../config/brand.json" with { type: "json" };

export const brand = data;
export const { org, region } = data;

/** Kod zgłoszenia, np. SPL-4K7Q: prefiks i cztery znaki bez 0, 1, I, O (lib/status-code.ts). */
export const STATUS_CODE = new RegExp(`^${data.statusPrefix}-[2-9A-HJ-NP-Z]{4}$`);

/** Kod TERYT powiatu z regionu: 4 cyfry zaczynające się od kodu województwa. */
export const COUNTY_TERYT = new RegExp(`^${data.region.terytPrefix}\\d{2}$`);

/** Tytuł strony Panelu: „Nabory · Panel ROPS”. */
export function panelTitle(page?: string): string {
  return page ? `${page} · Panel ${data.org.short}` : `Panel ${data.org.short}`;
}
