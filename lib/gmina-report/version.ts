import "server-only";
import { createHash } from "node:crypto";
import type { AreaKey } from "@/lib/knowledge/types";
import { AREA_QUERIES } from "./config";
import type { GminaProfile } from "./score";
import { cohortProfile, summaryFacts } from "./summary";

/** Zmiana promptu albo zasad sprawdzania = nowa wersja, więc wszystko przelicza się od nowa. */
const PROMPT_VERSION = "1";

const hash = (...parts: string[]) => createHash("sha1").update(parts.join("\u0000")).digest("hex").slice(0, 16);

/** Podsumowanie jest aktualne, dopóki model dostałby te same dane. */
export const summaryVersion = (p: GminaProfile) => hash(PROMPT_VERSION, summaryFacts(p));

/** Dopasowanie obszaru w grupie: zapytanie, profil grupy i stan Biblioteki (liczba i ostatnia zmiana innowacji). */
export const matchVersion = (p: GminaProfile, area: AreaKey, challenges: string, library: string) =>
  hash(PROMPT_VERSION, JSON.stringify(AREA_QUERIES[area]), challenges, cohortProfile(p, area), library);
