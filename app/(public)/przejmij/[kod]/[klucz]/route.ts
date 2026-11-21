import { redirect } from "next/navigation";
import { isAccessKey, rememberInitiative } from "@/lib/initiatives/access";
import { rateLimit } from "@/lib/rate-limit";
import { STATUS_CODE } from "@/lib/schemas";
import { keyOpens } from "@/lib/threads";

/**
 * Link do przejęcia wykrytej inicjatywy (/przejmij/KOD/klucz) — wysyła go zespół z Panelu. Jak prywatny link /r/…:
 * zapamiętuje parę kod–klucz w tej przeglądarce i przekierowuje bez klucza w adresie, żeby nie został w historii.
 */
export async function GET(request: Request, ctx: RouteContext<"/przejmij/[kod]/[klucz]">) {
  const limited = rateLimit(request, "claim-link", 20);
  if (limited) return limited;
  const { kod, klucz } = await ctx.params;
  const code = decodeURIComponent(kod).trim().toUpperCase();

  let ok = false;
  if (STATUS_CODE.test(code) && isAccessKey(klucz)) {
    try {
      ok = await keyOpens(code, klucz);
    } catch (e) {
      console.error("[przejęcie] link:", e);
    }
  }
  if (!ok) redirect("/przejmij?link=nieaktualny");
  await rememberInitiative(code, klucz);
  redirect(`/przejmij?kod=${code}`);
}
