import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/key";

// Odświeża sesję Supabase przy każdym żądaniu i chroni /panel oraz /ekspert.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Bez skonfigurowanego Supabase (np. praca nad samym UI) przepuszczamy żądania.
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return response;
  }

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Konto testowe (lib/auth.ts) nie ma sesji Supabase; podpis i rolę sprawdza strona panelu (requireAdmin).
  const testSession = request.cookies.has("spolecznik-test");
  const path = request.nextUrl.pathname;
  if (!user && !testSession && (path.startsWith("/panel") || path.startsWith("/ekspert"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/logowanie";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|geojson)$).*)"],
};
