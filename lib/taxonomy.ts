import type { CROSS, GROUPS, MWS_AREAS } from "./schemas";

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

export const CROSS_LABELS: Record<(typeof CROSS)[number], string> = {
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
