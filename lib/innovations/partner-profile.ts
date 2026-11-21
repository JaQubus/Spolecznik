// Profil partnera z formularza „Szukam innowacji” (8/10). Czysty moduł: walidacja zod i podział na profil partnera
// (publiczna tabela partners) oraz alert e-mail (prywatna innovation_alerts).
import { z } from "zod";
import { PARTNER_SUPPORT_KEYS, SECTOR_KEYS, TRL_MAX, TRL_MIN } from "../taxonomy.ts";

/** Rodzaje, które partner wybiera sam. Akceleratory i laboratoria PCI ('pci') dodaje wyłącznie zespół. */
export const SELF_SERVICE_PARTNER_KINDS = ["firma", "fundusz", "ctt", "jst"] as const;

const trl = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().int().min(TRL_MIN).max(TRL_MAX).optional(),
);

export const PartnerProfileInput = z
  .object({
    name: z.string().trim().min(2, "Wpisz nazwę organizacji.").max(120),
    kind: z.enum(SELF_SERVICE_PARTNER_KINDS, "Wybierz rodzaj organizacji."),
    description: z.string().trim().min(20, "Opisz w kilku zdaniach, czego szukasz (co najmniej 20 znaków).").max(600),
    sectors: z.array(z.enum(SECTOR_KEYS)).min(1, "Wybierz co najmniej jeden sektor.").max(SECTOR_KEYS.length),
    support: z.array(z.enum(PARTNER_SUPPORT_KEYS)).min(1, "Wybierz, w jaki sposób możesz pomóc.").max(PARTNER_SUPPORT_KEYS.length),
    trlMin: trl,
    trlMax: trl,
    email: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().toLowerCase().max(254).pipe(z.email("To nie wygląda jak adres e-mail.")).optional(),
    ),
  })
  .refine((v) => v.trlMin == null || v.trlMax == null || v.trlMin <= v.trlMax, { path: ["trlMax"], message: "TRL „do” nie może być niższy niż „od”." });

export type PartnerProfileInput = z.infer<typeof PartnerProfileInput>;

/** Pola formularza → obiekt do walidacji (pola wielokrotne jako tablice). */
export function profileFromForm(formData: FormData): Record<string, unknown> {
  return {
    name: formData.get("name") ?? "",
    kind: formData.get("kind") ?? "",
    description: formData.get("description") ?? "",
    sectors: formData.getAll("sectors"),
    support: formData.getAll("support"),
    trlMin: formData.get("trlMin") ?? "",
    trlMax: formData.get("trlMax") ?? "",
    email: formData.get("email") ?? "",
  };
}
