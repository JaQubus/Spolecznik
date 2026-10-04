import "server-only";

/**
 * Wysyłka e-maili przez Resend (README §4), zwykłym fetch. Bez RESEND_API_KEY nic nie wysyłamy, tylko logujemy
 * — demo działa bez konfiguracji i nie pisze do prawdziwych ludzi. Nadawca z EMAIL_FROM (domena zweryfikowana
 * w Resend); bez niego adres testowy Resend, który dostarcza tylko na adres właściciela konta.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[e-mail] brak RESEND_API_KEY — pomijam wiadomość „${msg.subject}”`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Społecznik <onboarding@resend.dev>",
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
    }),
  });
  if (!res.ok) {
    console.error("[e-mail] Resend:", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}
