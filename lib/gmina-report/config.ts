// Raport gminy (#104): konfiguracja w jednym miejscu. Bez importów z aliasem „@/”, żeby testy jednostkowe
// (node --experimental-strip-types) mogły ładować ten plik bezpośrednio.
import type { AreaKey } from "../knowledge/types.ts";

/**
 * „Wyższa wartość = większa potrzeba” (np. udział 65+) albo odwrotnie (np. dzieci w żłobkach na 1000).
 * Słowa „gorzej / lepiej” celowo nie padają — raport mówi o potrzebach, nie ocenia gmin.
 */
export type Direction = "need_up" | "need_down";
export type Level = "gmina" | "powiat";

export type AreaIndicator = {
  key: string;
  level: Level;
  direction: Direction;
  /** Wartość bezwzględna przeliczana na 10 tys. mieszkańców (ludność powiatu = suma jego gmin z BDL). */
  per10k?: boolean;
};

/**
 * Wskaźniki obszarów Mapy Wyzwań. Klucze jak w public/mapa/malopolska.json (data/map_indicators.py,
 * data/bdl_wskazniki.py). Dane gminne mają pierwszeństwo; cztery obszary mają dziś tylko dane powiatowe (IOSS 2024).
 */
export const AREA_INDICATORS: Record<AreaKey, AreaIndicator[]> = {
  seniorzy: [{ key: "udzial_65plus", level: "gmina", direction: "need_up" }],
  ubostwo: [{ key: "beneficjenci", level: "gmina", direction: "need_up" }],
  rodzina_piecza: [
    { key: "zlobki", level: "gmina", direction: "need_down" },
    { key: "przedszkola", level: "gmina", direction: "need_down" },
  ],
  zdrowie: [{ key: "przychodnie", level: "gmina", direction: "need_down" }],
  niepelnosprawnosc: [{ key: "niepelnosprawnosc", level: "powiat", direction: "need_up" }],
  bezdomnosc: [{ key: "bezdomnosc", level: "powiat", direction: "need_up" }],
  zdrowie_psychiczne: [{ key: "alkoholizm", level: "powiat", direction: "need_up" }],
  cudzoziemcy: [{ key: "saldo_zagraniczne", level: "powiat", direction: "need_up", per10k: true }],
};

/** Przedziały liczby mieszkańców w grupach porównawczych: [od, do) w osobach. */
export const POPULATION_BINS = [
  { key: "do5", label: "do 5 tys. mieszkańców", min: 0, max: 5_000 },
  { key: "5do15", label: "5–15 tys. mieszkańców", min: 5_000, max: 15_000 },
  { key: "od15", label: "ponad 15 tys. mieszkańców", min: 15_000, max: Infinity },
] as const;

/** Mniejsza grupa łączy się z sąsiednim przedziałem tego samego typu gminy — percentyl z 3 gmin nic nie mówi. */
export const MIN_COHORT = 8;

/** Poniżej tej liczby mieszkańców wynik oznaczamy jako orientacyjny (mała liczba zdarzeń mocno go zmienia). */
export const SMALL_GMINA = 5_000;

/**
 * Obszar trafia do „obszarów do uwagi”, gdy potrzeba jest większa niż w co najmniej 60% porównania. Przy 50 do uwagi
 * trafiały wartości praktycznie równe medianie; przy 60 tylko 2 ze 183 gmin nie mają żadnego obszaru do uwagi.
 */
export const FOCUS_MIN_SCORE = 60;
export const FOCUS_COUNT = 3;

/** Ile innowacji pod każdym obszarem do uwagi. */
export const INNOVATIONS_PER_AREA = 3;

/**
 * Zapytanie do silnika dopasowań dla obszaru, gdy nikt nie opisał problemu („matchmaking bez zgłoszenia”).
 * Słowa kluczowe w formie podstawowej, jak NeedCard.keywords; opis łączymy z wyzwaniami z Mapy Wyzwań (tabela areas).
 */
export const AREA_QUERIES: Record<AreaKey, { summary: string; keywords: string[] }> = {
  seniorzy: {
    summary: "Coraz więcej starszych mieszkańców potrzebuje opieki, towarzystwa i pomocy w codziennych sprawach.",
    keywords: ["senior", "osoba starsza", "samotność", "opieka", "opiekun", "usługa opiekuńcza", "aktywność"],
  },
  ubostwo: {
    summary: "Wiele osób i rodzin korzysta z pomocy społecznej, bo brakuje im pieniędzy na podstawowe potrzeby.",
    keywords: ["ubóstwo", "pomoc społeczna", "bezrobocie", "zadłużenie", "wykluczenie", "praca", "rodzina"],
  },
  rodzina_piecza: {
    summary: "Rodzinom z małymi dziećmi brakuje opieki nad dziećmi i wsparcia w wychowaniu.",
    keywords: ["dziecko", "rodzina", "rodzic", "żłobek", "przedszkole", "opieka nad dzieckiem", "piecza zastępcza"],
  },
  zdrowie: {
    summary: "Mieszkańcom trudno dostać się do lekarza i usług zdrowotnych blisko domu.",
    keywords: ["zdrowie", "lekarz", "przychodnia", "dostęp do usług", "profilaktyka", "transport", "rehabilitacja"],
  },
  niepelnosprawnosc: {
    summary: "Osoby z niepełnosprawnością i ich rodziny potrzebują wsparcia w codziennym życiu i w pracy.",
    keywords: ["niepełnosprawność", "osoba z niepełnosprawnością", "opiekun", "asystent", "dostępność", "praca"],
  },
  bezdomnosc: {
    summary: "Osoby w kryzysie bezdomności potrzebują schronienia, wsparcia i drogi do własnego mieszkania.",
    keywords: ["bezdomność", "osoba bezdomna", "mieszkanie", "schronisko", "noclegownia", "kryzys"],
  },
  zdrowie_psychiczne: {
    summary: "Mieszkańcy w kryzysie psychicznym i z uzależnieniami nie dostają wsparcia na czas.",
    keywords: ["zdrowie psychiczne", "kryzys psychiczny", "uzależnienie", "alkohol", "depresja", "wsparcie"],
  },
  cudzoziemcy: {
    summary: "Cudzoziemcy mieszkający w gminie potrzebują pomocy w nauce języka, sprawach urzędowych i w kontaktach z sąsiadami.",
    keywords: ["cudzoziemiec", "migrant", "uchodźca", "integracja", "język polski", "urząd"],
  },
};
