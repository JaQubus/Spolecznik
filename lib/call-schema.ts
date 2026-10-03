import { z } from "zod";

export const CallFormField = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "table"]),
});

export const CallFormSchema = z.object({ fields: z.array(CallFormField).min(1) });
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
