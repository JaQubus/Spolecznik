import { redirect } from "next/navigation";
import { isAccessKey, rememberInitiative } from "@/lib/initiatives/access";
import { rateLimit } from "@/lib/rate-limit";
import { STATUS_CODE } from "@/lib/schemas";
import { keyOpens } from "@/lib/threads";

/**
 * Prywatny link (/r/KOD/klucz): zapamiętuje zgłoszenie w tej przeglądarce i przekierowuje bez klucza w adresie,
 * żeby nie został w historii ani w odnośnikach. Zgłoszenie otwiera się w rozmowie na /rozmowy.
 */
export async function GET(request: Request, ctx: RouteContext<"/r/[kod]/[klucz]">) {
  const limited = rateLimit(request, "private-link", 20);
  if (limited) return limited;
  const { kod, klucz } = await ctx.params;
  const code = decodeURIComponent(kod).trim().toUpperCase();

  let ok = false;
  if (STATUS_CODE.test(code) && isAccessKey(klucz)) {
    try {
      ok = await keyOpens(code, klucz);
    } catch (e) {
      console.error("[prywatny link]", e);
    }
  }
  if (!ok) redirect("/rozmowy?link=nieaktualny");
  await rememberInitiative(code, klucz);
  redirect(`/rozmowy?kod=${code}`);
}
