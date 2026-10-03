import { z } from "zod";

export const CallFormField = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "table"]),
});

const text = z.string().min(1);

/** Punkt opisowy wzoru. `questions` to pytania z wzoru, `tip` to podpowiedź prostym językiem. */
const DescriptionSection = z.object({
  key: text,
  n: z.number().int().positive(),
  title: text,
  tip: text,
  questions: z.array(text),
});

const PlanPeriod = z.object({ title: text, limit: text, questions: text, example: text, termExample: text });

const DeclarationSet = z.object({
  title: text,
  lead: text,
  items: z.array(text).min(1),
  /** Streszczenie prostym językiem, pokazywane obok pełnej treści, nie zamiast niej. */
  summary: z.array(text),
});

/**
 * Treść wzoru wniosku dla /wniosek: pytania, oświadczenia i klauzule RODO danego naboru.
 * Struktura formularza (kroki, dane wnioskodawcy, tabela planu) jest w kodzie, tekst jest tutaj,
 * więc nowy nabór albo poprawka w oświadczeniu to zmiana `calls.form_schema`, nie wdrożenie.
 */
export const CallFormContent = z.object({
  attachment: text,
  intro: text,
  sections: z.array(DescriptionSection).min(1).refine(
    (sections) => new Set(sections.map((s) => s.key)).size === sections.length,
    "Klucze punktów opisowych muszą być unikalne",
  ),
  plan: z.object({
    intro: text,
    preparation: PlanPeriod,
    testing: PlanPeriod,
    amount: z.object({ title: text, questions: text }),
  }),
  team: DescriptionSection.omit({ key: true }),
  /** A: osoba fizyczna, B: reprezentant podmiotu. */
  declarations: z.object({ A: DeclarationSet, B: DeclarationSet }),
  rodo: z.array(z.object({ title: text, paragraphs: z.array(text).min(1) })),
});
export type CallFormContent = z.infer<typeof CallFormContent>;

export const CallFormSchema = z.object({
  /** Pola dla generatora szkicu z fiszki (/api/apply). */
  fields: z.array(CallFormField).min(1),
  /** Treść formularza /wniosek. Bez niej nabór nie ma formularza do wypełnienia. */
  content: CallFormContent.optional(),
});
export type CallFormSchema = z.infer<typeof CallFormSchema>;

/** Used only for legacy calls whose form_schema is null or an empty object. */
export const FALLBACK_CALL_FORM: CallFormSchema = {
  fields: [
    { key: "1_tytul", label: "Tytuł innowacji", type: "text" },
    { key: "3_opis_innowacji", label: "Opis innowacji", type: "textarea" },
    { key: "4_innowacyjnosc", label: "Na czym polega innowacyjność?", type: "textarea" },
    { key: "5_diagnoza_problemu", label: "Diagnoza problemu", type: "textarea" },
    { key: "6_odbiorcy", label: "Odbiorcy", type: "textarea" },
    { key: "7_zmiana", label: "Jaką zmianę przyniesie?", type: "textarea" },
    { key: "8_wizja_przyszlosci", label: "Kto i jak może to powielić?", type: "textarea" },
    { key: "9_plan_dzialania", label: "Plan działania i budżet", type: "table" },
    { key: "10_wnioskowana_kwota_grantu", label: "Wnioskowana kwota grantu (zł)", type: "number" },
    { key: "11_zespol_projektowy", label: "Zespół projektowy", type: "textarea" },
  ],
};

export function parseCallFormSchema(value: unknown): CallFormSchema {
  if (value == null || (typeof value === "object" && value !== null && Object.keys(value).length === 0)) {
    return FALLBACK_CALL_FORM;
  }
  return CallFormSchema.parse(value);
}

/**
 * Same pola dla generatora (/api/apply). Błąd w treści formularza /wniosek nie może wyłączyć
 * generatora, a błędne lub puste pola zastępujemy wzorem IWS, jak przed wprowadzeniem content.
 */
export function parseCallFields(value: unknown): CallFormSchema["fields"] {
  const parsed = CallFormSchema.pick({ fields: true }).safeParse(value);
  return parsed.success ? parsed.data.fields : FALLBACK_CALL_FORM.fields;
}
