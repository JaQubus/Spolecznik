// Filtry publicznej bazy innowacji (/innowacje) czytane z adresu. Czyste funkcje bez importów serwerowych.
import {
  DOMAIN_KEYS, INNOVATION_KIND_KEYS, INSTITUTION_KEYS, RADAR, SECTOR_KEYS, STAGE_KEYS, TRL_MAX, TRL_MIN,
  type DomainKey, type InnovationKindKey, type InstitutionKey, type SectorKey, type StageKey,
} from "../taxonomy.ts";

export type InnovationFilters = {
  kind?: InnovationKindKey;
  sector?: SectorKey;
  domain?: DomainKey;
  institution?: InstitutionKey;
  stage?: StageKey;
  /** Co najmniej taki poziom gotowości technologii (TRL 1–9). */
  trlMin?: number;
  /** Klucz poziomu sygnału z config/taxonomy.json (radar.levels): pokazujemy ten poziom i wyższe. */
  signal?: string;
  /** Cztery pierwsze cyfry TERYT powiatu. */
  county?: string;
};

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const pick = <T extends string>(keys: readonly T[], v: string) => ((keys as readonly string[]).includes(v) ? (v as T) : undefined);

/** Poziomy sygnału, które da się wybrać w filtrze: wszystkie poza najniższym (on przepuszcza wszystko). */
export const SIGNAL_FILTER_LEVELS = RADAR.levels.filter((l) => l.min > 0);

/** Najniższy sygnał (0–100) dla klucza poziomu albo null, gdy klucz nieznany. */
export const signalMinFor = (key: string | undefined): number | null => SIGNAL_FILTER_LEVELS.find((l) => l.key === key)?.min ?? null;

export function parseFilters(sp: Params): InnovationFilters {
  const trl = Number(one(sp.trl));
  const county = one(sp.powiat);
  return {
    kind: pick(INNOVATION_KIND_KEYS, one(sp.typ)),
    sector: pick(SECTOR_KEYS, one(sp.sektor)),
    domain: pick(DOMAIN_KEYS, one(sp.dziedzina)),
    institution: pick(INSTITUTION_KEYS, one(sp.instytucja)),
    stage: pick(STAGE_KEYS, one(sp.etap)),
    trlMin: Number.isInteger(trl) && trl >= TRL_MIN && trl <= TRL_MAX ? trl : undefined,
    signal: signalMinFor(one(sp.sygnal)) != null ? one(sp.sygnal) : undefined,
    county: /^\d{4}$/.test(county) ? county : undefined,
  };
}

const PARAM: Record<keyof InnovationFilters, string> = {
  kind: "typ", sector: "sektor", domain: "dziedzina", institution: "instytucja", stage: "etap", trlMin: "trl", signal: "sygnal", county: "powiat",
};

/** Adres listy z filtrami; `without` pomija wybrane filtry (np. powiat w linkach mapy). */
export function filtersHref(f: InnovationFilters, change: Partial<Record<keyof InnovationFilters, string | number | undefined>> = {}, anchor = ""): string {
  const merged: Record<string, string | number | undefined> = { ...f, ...change };
  const q = new URLSearchParams();
  for (const key of Object.keys(PARAM) as (keyof InnovationFilters)[]) {
    const v = merged[key];
    if (v != null && v !== "") q.set(PARAM[key], String(v));
  }
  const s = q.toString();
  return `/innowacje${s ? `?${s}` : ""}${anchor}`;
}

export const activeFilterCount = (f: InnovationFilters) => Object.values(f).filter((v) => v != null).length;
