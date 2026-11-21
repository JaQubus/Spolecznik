import "server-only";
import { z } from "zod";
import { sendEmail } from "./email";
import { keyMatches } from "./initiatives/access";
import { createAdminClient } from "./supabase/admin";
import { brand, org } from "@/lib/brand";

export const ContactRequest = z.object({
  code: z.string().trim().min(4).max(20),
  key: z.string().trim().min(10).max(100),
  // Pusty napis = usuń adres (rezygnacja z powiadomień).
  email: z.union([z.literal(""), z.email("Wpisz adres e-mail w formacie nazwa@domena.pl.").max(200)]),
});

/** Zapis albo usunięcie adresu. Klucz z prywatnego linku potwierdza, że pisze autor. false = kod i klucz nie pasują. */
export async function saveContactEmail(code: string, key: string, email: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("initiatives").select("access_hash").eq("status_code", code).maybeSingle();
  if (error) throw error;
  if (!keyMatches((data?.access_hash as string | null) ?? null, key)) return false;
  const { error: uError } = await supabase
    .from("initiatives")
    .update({ contact_email: email.trim().toLowerCase() || null })
    .eq("status_code", code);
  if (uError) throw uError;
  return true;
}

/** „ola@example.pl” → „o•••@example.pl”: autor rozpozna swój adres, a ktoś przy cudzym ekranie go nie przepisze. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return domain ? `${user.slice(0, 1)}•••@${domain}` : "•••";
}

/** Zapisany adres zgłoszenia (zamaskowany) — dla autora z kluczem, na stronie statusu i rozmowy. */
export async function maskedContactEmail(code: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("initiatives").select("contact_email").eq("status_code", code).maybeSingle();
  if (error) throw error;
  return data?.contact_email ? maskEmail(data.contact_email as string) : null;
}

/** Link do statusu w mailu. Bez SITE_URL piszemy, gdzie wpisać kod, zamiast zgadywać domenę. */
function statusLine(code: string): string {
  const site = process.env.SITE_URL?.replace(/\/$/, "");
  return site
    ? `Sprawdzisz to tutaj: ${site}/status/${code}`
    : `Wejdź na stronę ${brand.nameGenitive}, kliknij „Sprawdź status” i wpisz kod ${code}.`;
}

/**
 * E-mail do autora zgłoszenia, jeśli podał adres. Treść tylko ogólna (kod + link do statusu), bez treści
 * zgłoszenia i odpowiedzi — e-mail może przeczytać ktoś inny. Dane syntetyczne nigdy nie dostają maili.
 * Błędy tylko logujemy: brak maila nie może zatrzymać odpowiedzi zespołu.
 */
export async function emailAuthor(initiativeId: string, what: string): Promise<void> {
  try {
    const { data, error } = await createAdminClient()
      .from("initiatives")
      .select("status_code, contact_email, synthetic")
      .eq("id", initiativeId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.contact_email || data.synthetic || !data.status_code) return;
    const code = data.status_code as string;
    await sendEmail({
      to: data.contact_email as string,
      subject: `${brand.name}: ${what} (${code})`,
      text: [
        "Dzień dobry,",
        "",
        `${what} — dotyczy Twojego zgłoszenia ${code}.`,
        statusLine(code),
        "",
        "To wiadomość automatyczna, nie odpowiadaj na nią.",
        "Nie chcesz więcej takich wiadomości? Otwórz prywatny link do zgłoszenia i usuń adres e-mail.",
        "",
        `${brand.name} — ${org.name}`,
      ].join("\n"),
    });
  } catch (e) {
    console.error("[e-mail] autor zgłoszenia:", e);
  }
}
