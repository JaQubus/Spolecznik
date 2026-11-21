import data from "../config/taxonomy.json" with { type: "json" };
import type { CROSS as OLD_CROSS, GROUPS, MWS_AREAS } from "./schemas";

/**
 * Słowniki Radaru. Treść (etykiety, opisy do promptów, wagi radaru) jest w config/taxonomy.json — ten sam plik
 * czyta pipeline Pythona (data/common.py). Krotki kluczy są tu wpisane jawnie, bo z.enum i wyczerpujące
 * Record<Klucz, Ikona> potrzebują literałów; test tests/unit/taxonomy.test.ts pilnuje zgodności z JSON-em.
 */
export const DOMAIN_KEYS = [
  "edukacja", "nauka", "cyfryzacja", "administracja", "srodowisko", "zdrowie", "uslugi_spoleczne", "mobilnosc",
  "kultura", "gospodarka", "partycypacja",
] as const;
export const INSTITUTION_KEYS = [
  "szkola_podstawowa", "szkola_ponadpodstawowa", "uczelnia", "gmina", "powiat", "kultura", "pomoc_zdrowie", "inna",
] as const;
export const STAGE_KEYS = ["pomysl", "pilotaz", "dziala", "przeniesiona"] as const;
export const CROSS_KEYS = [
  "obszary_wiejskie", "depopulacja", "mlodzi", "seniorzy", "wykluczenie_cyfrowe", "wspolpraca", "pogranicze",
] as const;
export const RADAR_KEYS = ["przenaszalnosc", "wplyw", "dojrzalosc", "nowosc", "latwosc"] as const;

export type DomainKey = (typeof DOMAIN_KEYS)[number];
export type InstitutionKey = (typeof INSTITUTION_KEYS)[number];
export type StageKey = (typeof STAGE_KEYS)[number];
export type CrossKey = (typeof CROSS_KEYS)[number];
export type RadarKey = (typeof RADAR_KEYS)[number];

export type TaxonomyEntry = { label: string; slug: string; description: string };
export type RadarDimension = { label: string; short: string; question: string; anchors: Record<string, string> };
export type SignalLevel = { min: number; key: string; label: string };

export const DOMAINS = data.domains as Record<DomainKey, TaxonomyEntry>;
export const INSTITUTION_TYPES = data.institutionTypes as Record<InstitutionKey, TaxonomyEntry>;
export const STAGES = data.stages as Record<StageKey, TaxonomyEntry>;
export const CROSS = data.cross as Record<CrossKey, TaxonomyEntry>;

export const RADAR = data.radar as {
  dimensions: Record<RadarKey, RadarDimension>;
  weights: Record<RadarKey, number>;
  /** Najwyższa ocena dojrzałości dla etapu: pomysł nie może być „sprawdzony w praktyce”. */
  maturityCap: Record<StageKey, number>;
  /** Inicjatywa już przeniesiona gdzie indziej ma co najmniej tyle za przenaszalność. */
  transferredMinPortability: number;
  /** Ocena wymiaru, o którym opis nic nie mówi (basis = brak_danych), nie przekracza tej wartości. */
  noDataMax: number;
  /** Od najwyższego progu. */
  levels: SignalLevel[];
};

export function signalLevel(signal: number): SignalLevel {
  return RADAR.levels.find((l) => signal >= l.min) ?? RADAR.levels[RADAR.levels.length - 1];
}

// ── Słowniki Społecznika: zostają, dopóki aplikacja nie przejdzie na nowy schemat (Radar 3b) ──

export const AREA_LABELS: Record<(typeof MWS_AREAS)[number], string> = {
  rodzina_piecza: "Rodzina i piecza zastępcza",
  bezdomnosc: "Bezdomność",
  niepelnosprawnosc: "Niepełnosprawność",
  ubostwo: "Ubóstwo",
  cudzoziemcy: "Integracja cudzoziemców",
  zdrowie: "Zdrowie",
  zdrowie_psychiczne: "Zdrowie psychiczne",
  seniorzy: "Seniorzy",
};

export const GROUP_LABELS: Record<(typeof GROUPS)[number], string> = {
  seniorzy: "Dla seniorów",
  dzieci_mlodziez_rodzina: "Dla dzieci, młodzieży i rodziny",
  ograniczona_mobilnosc: "Dla osób o ograniczonej mobilności",
  niepelnosprawnosc_sensoryczna: "Dla osób z niepełnosprawnością sensoryczną",
  zdrowie_medycyna: "Dla zdrowia i medycyny",
  rynek_pracy: "Dla rynku pracy",
  cudzoziemcy: "Dla cudzoziemców",
  bezdomnosc: "Dla osób w kryzysie bezdomności",
  niepelnosprawnosc_intelektualna: "Dla osób z niepełnosprawnością intelektualną",
};

export const CROSS_LABELS: Record<(typeof OLD_CROSS)[number], string> = {
  samotnosc: "Samotność",
  wykluczenie_cyfrowe: "Wykluczenie cyfrowe",
  dostep_do_uslug: "Dostęp do usług społecznych",
  depopulacja_suburbanizacja: "Depopulacja i suburbanizacja",
  wspolpraca_miedzysektorowa: "Koordynacja międzysektorowa",
};

/** Typ gminy z 7. cyfry kodu TERYT: 1 miejska, 2 wiejska, 3 miejsko-wiejska. */
export function gminaType(teryt: string): "miejska" | "wiejska" | "miejsko-wiejska" | null {
  const d = teryt.charAt(6);
  if (d === "1") return "miejska";
  if (d === "2") return "wiejska";
  if (d === "3") return "miejsko-wiejska";
  return null;
}
