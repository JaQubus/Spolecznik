import { z } from "zod";

// Treść wzoru „Wniosku o grant” do naboru ROPS „Usługa Wrażliwa” (data/usluga_wrazliwa_wniosek.json, #105).
// Struktura formularza jest w kodzie (/wniosek-o-grant), tekst tutaj: nowy nabór to zmiana danych, nie wdrożenie.

const text = z.string().min(1);

const Section = z.object({ n: text, title: text, tip: text, questions: z.array(text) });

export const SECTION_KEYS = [
  "tytul", "opis", "daty", "grupy", "diagnoza", "rekrutacja", "liczba", "obszar", "efekty",
  "plan", "wskaznik", "kwota", "cross", "trwaloscCross", "horyzontalne", "utrzymanie", "deinstytucjonalizacja",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const UwContent = z.object({
  call: z.object({
    title: text,
    order: text, // numer zarządzenia, np. IS-430-6/26
    url: z.url(),
    formUrl: z.url(), // elektroniczny formularz ROPS — jedyna droga złożenia wniosku
    opensAt: z.iso.date(),
    closesAt: z.iso.date(),
    contact: text,
  }),
  intro: text,
  innovations: z.array(z.object({ title: text, slug: text })).min(1),
  statuses: z.array(text).min(1),
  experience: z.object({ lead: text, areas: z.array(text).length(3), tip: text }),
  targetGroups: z.array(text).min(1),
  sections: z.object(Object.fromEntries(SECTION_KEYS.map((k) => [k, Section])) as Record<SectionKey, typeof Section>),
  declarations: z.object({
    title: text,
    lead: text,
    items: z.array(text).min(1),
    deMinimis: z.object({ lead: text, options: z.array(text).length(2) }),
    /** Streszczenie prostym językiem, pokazywane obok pełnej treści, nie zamiast niej. */
    summary: z.array(text),
    attachmentNote: text,
  }),
});
export type UwContent = z.infer<typeof UwContent>;
