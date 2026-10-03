import { redirect } from "next/navigation";
import { isAccessKey, keyMatches, rememberNeed } from "@/lib/need-access";
import { rateLimit } from "@/lib/rate-limit";
import { STATUS_CODE } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Prywatny link do rozmowy (/r/SPL-4K7Q/klucz): zapamiętuje zgłoszenie w tej przeglądarce
 * i przekierowuje na /zapytaj bez klucza w adresie, żeby nie został w historii ani w odnośnikach.
 */
export async function GET(request: Request, ctx: RouteContext<"/r/[kod]/[klucz]">) {
  const limited = rateLimit(request, "prywatny-link", 20);
  if (limited) return limited;
  const { kod, klucz } = await ctx.params;
  const code = decodeURIComponent(kod).trim().toUpperCase();

  let ok = false;
  if (STATUS_CODE.test(code) && isAccessKey(klucz)) {
    try {
      const { data, error } = await createAdminClient().from("needs").select("access_hash").eq("status_code", code).maybeSingle();
      if (error) throw error;
      ok = keyMatches(data?.access_hash ?? null, klucz);
    } catch (e) {
      console.error("[prywatny link]", e);
    }
  }
  if (!ok) redirect("/zapytaj?link=nieaktualny");
  await rememberNeed(code, klucz);
  redirect(`/zapytaj?potrzeba=${code}`);
}
