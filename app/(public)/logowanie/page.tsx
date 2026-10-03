import { ArrowRightEndOnRectangleIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getViewer, isTestLoginEnabled, safeNext } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { logout, passwordLogin, testLogin } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Logowanie" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const ERRORS: Record<string, string> = {
  puste: "Wpisz adres e-mail i hasło.",
  haslo: "Nie udało się zalogować. Sprawdź adres e-mail i hasło.",
  test: "Logowanie testowe jest wyłączone na tym serwerze.",
  link: "Link do logowania nie zadziałał. Mógł wygasnąć albo został już użyty. Wpisz adres e-mail, a wyślemy nowy.",
};

const ROLE_LABELS: Record<string, string> = {
  mieszkaniec: "mieszkaniec",
  organizacja: "organizacja",
  jst: "samorząd (JST)",
  ekspert: "ekspert",
  admin: "administrator ROPS",
};

export default async function Page(props: PageProps<"/logowanie">) {
  const params = await props.searchParams;
  // ?next= (Panel, proxy.ts) albo ?dalej= (starsze linki z Zasobnika).
  const next = safeNext(first(params.next) || first(params.dalej));
  const error = ERRORS[first(params.blad)];
  const viewer = await getViewer();
  const testEnabled = isTestLoginEnabled();
  const supabaseEnabled = isSupabaseConfigured();

  return (
    <section className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">{viewer ? "Jesteś zalogowany" : "Logowanie"}</h1>

      {error && <Alert tone="error" title="Błąd logowania"><p>{error}</p></Alert>}

      {viewer ? (
        <div className="space-y-4">
          <p className="text-lg">
            Konto: <strong>{viewer.label}</strong>, rola: <strong>{ROLE_LABELS[viewer.role] ?? viewer.role}</strong>.
          </p>
          {viewer.role === "admin" && (
            <p>
              <Link href={next} className="text-lg font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
                Przejdź do Panelu
              </Link>
            </p>
          )}
          <form action={logout}>
            <Button type="submit" variant="outline"><ArrowRightStartOnRectangleIcon aria-hidden />Wyloguj się</Button>
          </form>
        </div>
      ) : (
        <>
          <p className="text-lg">
            Konto jest dla samorządów, ekspertów i pracowników ROPS. Żeby opisać problem, sprawdzić status albo
            przeglądać bibliotekę, nie musisz się logować.
          </p>

          {supabaseEnabled && (
            <>
              <LoginForm next={next} />
              <details className="max-w-md">
                <summary className="cursor-pointer text-lg font-bold">Masz hasło? Zaloguj się hasłem</summary>
                <form action={passwordLogin} className="mt-4 space-y-5" noValidate>
                  <input type="hidden" name="dalej" value={next} />
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email-haslo">Adres e-mail</Label>
                    <Input id="email-haslo" name="email" type="email" autoComplete="email" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="haslo">Hasło</Label>
                    <Input id="haslo" name="haslo" type="password" autoComplete="current-password" />
                  </div>
                  <Button type="submit" variant="outline"><ArrowRightEndOnRectangleIcon aria-hidden />Zaloguj się</Button>
                </form>
              </details>
            </>
          )}

          {testEnabled && (
            <section aria-labelledby="konto-testowe" className="space-y-4">
              <h2 id="konto-testowe" className="text-2xl font-bold">Konto testowe</h2>
              <Alert title="Tylko do testów">
                <p>Wybierz rolę jednym przyciskiem. To zastępuje prawdziwe konta, dopóki nie podłączymy logowania ROPS.</p>
              </Alert>
              <form action={testLogin} className="flex flex-col gap-3 sm:flex-row">
                <input type="hidden" name="dalej" value={next} />
                <Button type="submit" name="rola" value="admin" variant={supabaseEnabled ? "outline" : "default"}>
                  <ArrowRightEndOnRectangleIcon aria-hidden />Wejdź jako administrator ROPS
                </Button>
                <Button type="submit" name="rola" value="mieszkaniec" variant="outline">
                  <ArrowRightEndOnRectangleIcon aria-hidden />Wejdź jako mieszkaniec
                </Button>
              </form>
              <FieldHint>Konto mieszkańca pozwala sprawdzić, że panel administratora jest dla niego niedostępny.</FieldHint>
            </section>
          )}

          {!testEnabled && !supabaseEnabled && (
            <Alert title="Logowanie jest wyłączone">
              <p>Brakuje adresu albo klucza publicznego Supabase w pliku .env.local.</p>
            </Alert>
          )}
        </>
      )}
    </section>
  );
}
