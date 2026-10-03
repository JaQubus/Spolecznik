import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Powrót z linku logowania: wymiana kodu na sesję i przekierowanie tam, skąd przyszedł użytkownik. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Tylko ścieżki w obrębie serwisu — bez otwartego przekierowania na obce domeny.
  const next = url.searchParams.get("next") ?? "/";
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(target, url.origin));
    console.error("[auth/callback]", error);
  }
  return NextResponse.redirect(new URL("/logowanie?blad=link", url.origin));
}
