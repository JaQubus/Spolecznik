import "server-only";
import { z } from "zod";
import { sendEmail } from "./email";
import { keyMatches } from "./need-access";
import { createAdminClient } from "./supabase/admin";

export type ReportKind = "potrzeba" | "pomysl";
const TABLE = { potrzeba: "needs", pomysl: "ideas" } as const;

export const ContactRequest = z.object({
  code: z.string().trim().min(4).max(20),
  key: z.string().trim().min(10).max(100),
  // Pusty napis = usuń adres (rezygnacja z powiadomień).
  email: z.union([z.literal(""), z.email("Wpisz adres e-mail w formacie nazwa@domena.pl.").max(200)]),
});

/** Zapis albo usunięcie adresu. Klucz z prywatnego linku potwierdza, że pisze autor. false = kod i klucz nie pasują. */
export async function saveContactEmail(code: string, key: string, email: string): Promise<boolean> {
  // Jak reportForKey w threads.ts (tu bez importu, bo threads.ts wysyła e-maile przez ten plik).
  const supabase = createAdminClient();
  const [need, idea] = await Promise.all([
    supabase.from("needs").select("access_hash").eq("status_code", code).maybeSingle(),
    supabase.from("ideas").select("access_hash").eq("status_code", code).maybeSingle(),
  ]);
  if (need.error) throw need.error;
  if (idea.error) throw idea.error;
  const kind: ReportKind | null = keyMatches(need.data?.access_hash ?? null, key) ? "potrzeba"
    : keyMatches(idea.data?.access_hash ?? null, key) ? "pomysl" : null;
  if (!kind) return false;
  const { error } = await supabase
    .from(TABLE[kind])
    .update({ contact_email: email.trim().toLowerCase() || null })
    .eq("status_code", code);
  if (error) throw error;
  return true;
}

/** „ola@example.pl” → „o•••@example.pl”: autor rozpozna swój adres, a ktoś przy cudzym ekranie go nie przepisze. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return domain ? `${user.slice(0, 1)}•••@${domain}` : "•••";
}

/** Zapisany adres zgłoszenia (zamaskowany) — dla autora z kluczem, na stronie statusu i rozmowy. */
export async function maskedContactEmail(kind: ReportKind, code: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from(TABLE[kind]).select("contact_email").eq("status_code", code).maybeSingle();
  if (error) throw error;
  return data?.contact_email ? maskEmail(data.contact_email as string) : null;
}

/** Link do statusu w mailu. Bez SITE_URL piszemy, gdzie wpisać kod, zamiast zgadywać domenę. */
function statusLine(code: string): string {
  const site = process.env.SITE_URL?.replace(/\/$/, "");
  return site
    ? `Sprawdzisz to tutaj: ${site}/status/${code}`
    : `Wejdź na stronę Społecznika, kliknij „Sprawdź status” i wpisz kod ${code}.`;
}

/**
 * E-mail do autora zgłoszenia, jeśli podał adres. Treść tylko ogólna (kod + link do statusu), bez treści
 * zgłoszenia i odpowiedzi — e-mail może przeczytać ktoś inny. Dane syntetyczne nigdy nie dostają maili.
 * Błędy tylko logujemy: brak maila nie może zatrzymać odpowiedzi ROPS.
 */
export async function emailAuthor(kind: ReportKind, id: string, what: string): Promise<void> {
  try {
    const { data, error } = await createAdminClient()
      .from(TABLE[kind])
      .select("status_code, contact_email, synthetic")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.contact_email || data.synthetic || !data.status_code) return;
    const code = data.status_code as string;
    await sendEmail({
      to: data.contact_email as string,
      subject: `Społecznik: ${what} (${code})`,
      text: [
        "Dzień dobry,",
        "",
        `${what} — dotyczy Twojego zgłoszenia ${code}.`,
        statusLine(code),
        "",
        "To wiadomość automatyczna, nie odpowiadaj na nią.",
        "Nie chcesz więcej takich wiadomości? Otwórz prywatny link do zgłoszenia i usuń adres e-mail.",
        "",
        "Społecznik — Regionalny Ośrodek Polityki Społecznej w Krakowie",
      ].join("\n"),
    });
  } catch (e) {
    console.error("[e-mail] autor zgłoszenia:", e);
  }
}

/**
 * E-mail do testera bez konta (Próba, #96), jeśli podał adres: ROPS zmienił status testu. Jak emailAuthor — tylko
 * tytuł rozwiązania i status, bez opinii. Błędy tylko logujemy: brak maila nie może zatrzymać zmiany statusu.
 */
export async function emailTester(to: string, title: string | null, status: string, href: string | null): Promise<void> {
  const site = process.env.SITE_URL?.replace(/\/$/, "");
  try {
    await sendEmail({
      to,
      subject: `Społecznik: ${status} — test rozwiązania`,
      text: [
        "Dzień dobry,",
        "",
        `ROPS zmienił status Waszego testu${title ? ` rozwiązania „${title}”` : ""}: ${status}.`,
        ...(site && href ? [`Opis rozwiązania: ${site}${href}`] : []),
        "",
        "To wiadomość automatyczna, nie odpowiadaj na nią. Adres służy tylko do powiadomień o tym teście.",
        "",
        "Społecznik — Regionalny Ośrodek Polityki Społecznej w Krakowie",
      ].join("\n"),
    });
  } catch (e) {
    console.error("[e-mail] tester:", e);
  }
}
