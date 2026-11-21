import { ContactRequest, saveContactEmail } from "@/lib/author-contact";
import { rateLimit } from "@/lib/rate-limit";

/** Nieobowiązkowy e-mail autora do powiadomień o zgłoszeniu (#65). Kod + klucz z prywatnego linku. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "kontakt", 10);
  if (limited) return limited;
  const parsed = ContactRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.find((i) => i.path[0] === "email");
    return Response.json({ error: emailIssue?.message ?? "Nieprawidłowe dane" }, { status: 400 });
  }
  const { code, key, email } = parsed.data;
  try {
    const ok = await saveContactEmail(code.toUpperCase(), key, email);
    if (!ok) return Response.json({ error: "Ten link nie pasuje do zgłoszenia." }, { status: 403 });
    return Response.json({ saved: email !== "" });
  } catch (e) {
    console.error("[kontakt]", e);
    return Response.json({ error: "Nie udało się zapisać adresu. Spróbuj ponownie za chwilę." }, { status: 500 });
  }
}
