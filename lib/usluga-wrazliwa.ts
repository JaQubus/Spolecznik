import "server-only";
import framework from "@/data/out/usluga_wrazliwa.json";
import content from "@/data/usluga_wrazliwa_wniosek.json";
import { UwContent } from "./uw-content";

/** Treść wzoru wniosku aktualnego naboru. Błąd w JSON-ie wychodzi przy starcie, nie u użytkownika w połowie formularza. */
export const UW_CONTENT: UwContent = UwContent.parse(content);

export type FrameworkPlan = {
  call: string; // „I” albo „II” nabór
  url: string; // PDF Ramowego Planu Wdrożenia na rops.krakow.pl
  essence: string | null; // czego nie można zgubić / istota i wyróżniki
  mandatory: string | null; // co jest obowiązkowe / co warto uzupełnić
  checklist: string | null; // checklista / czego unikać
};

const PLANS = framework as Record<string, FrameworkPlan>;

/** Ramowy Plan Wdrożenia ROPS dla innowacji z naboru „Usługa Wrażliwa” (data/usluga_wrazliwa.py). */
export function frameworkPlan(slug: string | null | undefined): FrameworkPlan | null {
  return (slug && PLANS[slug]) || null;
}

/**
 * Fragmenty Ramowego Planu jako kontekst dla modelu. Limit znaków trzyma prompt w budżecie Groq
 * (darmowy plan: 8 tys. tokenów na minutę), a najważniejsze jest to, czego nie można zgubić.
 */
export function frameworkContext(slug: string | null | undefined, maxChars = 2400): string | null {
  const plan = frameworkPlan(slug);
  if (!plan) return null;
  const parts = [
    plan.essence && `Czego nie można zgubić:\n${plan.essence}`,
    plan.mandatory && `Co jest obowiązkowe:\n${plan.mandatory}`,
    plan.checklist && `Checklista i czego unikać:\n${plan.checklist}`,
  ].filter((p): p is string => !!p);
  const share = Math.floor(maxChars / Math.max(1, parts.length));
  return parts.map((p) => (p.length > share ? `${p.slice(0, share).trimEnd()}…` : p)).join("\n\n");
}
