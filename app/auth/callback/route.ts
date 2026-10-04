import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Za proxy (Vercel itp.) prawdziwa domena jest w x-forwarded-host, nie w request.url.
function siteOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host");
  if (!host) return request.nextUrl.origin;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Magic link z e-maila wraca tutaj z ?code=… (PKCE); wymieniamy go na sesję w ciasteczkach.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = siteOrigin(request);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth/callback]", error);
  }
  return NextResponse.redirect(new URL(`/logowanie?blad=link&next=${encodeURIComponent(next)}`, origin));
}
