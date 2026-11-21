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

export type CallStatus = { name: string; inCurrentCall: boolean; open: boolean; closesAt: string };

/**
 * Czy dla tej innowacji można teraz złożyć wniosek: jest w aktualnym naborze i nabór trwa. Karta innowacji i plan
 * nie mogą obiecywać „do 600 tys. zł”, gdy nabór jest zamknięty albo innowacja była w innym naborze.
 */
export function callStatus(slug: string | null | undefined, today: string): CallStatus | null {
  const plan = frameworkPlan(slug);
  if (!plan) return null;
  const inCurrentCall = plan.call === UW_CONTENT.call.name && UW_CONTENT.innovations.some((i) => i.slug === slug);
  const open = inCurrentCall && today >= UW_CONTENT.call.opensAt && today <= UW_CONTENT.call.closesAt;
  return { name: plan.call, inCurrentCall, open, closesAt: UW_CONTENT.call.closesAt };
}

export const formatDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
