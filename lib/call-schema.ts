import { z } from "zod";

export const CallFormField = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "table"]),
});

/**
 * programs.form_schema: pola dla generatora szkicu wniosku z karty inicjatywy (/api/apply). Formularz wniosku
 * z danymi wnioskodawcy (dawne /wniosek) usunęliśmy — Radar nie zbiera danych osób; wniosek składa się u operatora programu.
 */
export const CallFormSchema = z.object({
  fields: z.array(CallFormField).min(1),
});
export type CallFormSchema = z.infer<typeof CallFormSchema>;

/** Pola domyślne dla generatora, gdy program nie ma `fields` albo są błędne (parseCallFields). */
export const FALLBACK_CALL_FORM: CallFormSchema = {
  fields: [
    { key: "1_tytul", label: "Tytuł inicjatywy", type: "text" },
    { key: "3_opis_inicjatywy", label: "Opis inicjatywy", type: "textarea" },
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

/**
 * Pola dla generatora (/api/apply). Błędne lub puste pola zastępujemy wzorem domyślnym.
 */
export function parseCallFields(value: unknown): CallFormSchema["fields"] {
  const parsed = CallFormSchema.pick({ fields: true }).safeParse(value);
  if (parsed.success) return parsed.data.fields;
  if (value != null && Object.keys(value).length) console.warn("[apply] Błędne form_schema.fields, używam wzoru IWS", parsed.error);
  return FALLBACK_CALL_FORM.fields;
}
