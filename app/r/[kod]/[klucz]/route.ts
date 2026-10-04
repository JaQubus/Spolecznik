import { redirect } from "next/navigation";
import { isAccessKey, rememberNeed } from "@/lib/need-access";
import { rateLimit } from "@/lib/rate-limit";
import { STATUS_CODE } from "@/lib/schemas";
import { reportForKey } from "@/lib/threads";

/**
 * Prywatny link (/r/SPL-4K7Q/klucz): zapamiętuje zgłoszenie w tej przeglądarce i przekierowuje bez klucza w adresie,
 * żeby nie został w historii ani w odnośnikach. Potrzeba i pomysł → rozmowa na /zapytaj (z linkiem do statusu).
 */
export async function GET(request: Request, ctx: RouteContext<"/r/[kod]/[klucz]">) {
  const limited = rateLimit(request, "prywatny-link", 20);
  if (limited) return limited;
  const { kod, klucz } = await ctx.params;
  const code = decodeURIComponent(kod).trim().toUpperCase();

  let kind: Awaited<ReturnType<typeof reportForKey>> = null;
  if (STATUS_CODE.test(code) && isAccessKey(klucz)) {
    try {
      kind = await reportForKey(code, klucz);
    } catch (e) {
      console.error("[prywatny link]", e);
    }
  }
  if (!kind) redirect("/zapytaj?link=nieaktualny");
  await rememberNeed(code, klucz);
  redirect(`/zapytaj?potrzeba=${code}`);
}
