import { ArrowRightEndOnRectangleIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getViewer, isTestLoginEnabled } from "@/lib/auth";
import { logout, passwordLogin, testLogin } from "./actions";

export const metadata: Metadata = { title: "Logowanie" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const ERRORS: Record<string, string> = {
  puste: "Wpisz adres e-mail i hasło.",
  haslo: "Nie udało się zalogować. Sprawdź adres e-mail i hasło.",
  test: "Logowanie testowe jest wyłączone na tym serwerze.",
};

export default async function Page(props: PageProps<"/logowanie">) {
  const params = await props.searchParams;
  const next = first(params.dalej);
  const error = ERRORS[first(params.blad)];
  const viewer = await getViewer();
  const testEnabled = isTestLoginEnabled();
  const passwordEnabled = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <section className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Logowanie</h1>
      <p className="text-lg">
        Logowanie jest potrzebne tylko pracownikom ROPS, gminom i ekspertom. Aby opisać problem albo przeglądać bibliotekę,
        nie musisz zakładać konta.
      </p>

      {error && <Alert tone="error" title="Błąd logowania"><p>{error}</p></Alert>}

      {viewer ? (
        <div className="space-y-4">
          <p className="text-lg">Jesteś zalogowany jako: <strong>{viewer.label}</strong>.</p>
          <form action={logout}>
            <Button type="submit" variant="outline"><ArrowRightStartOnRectangleIcon aria-hidden />Wyloguj się</Button>
          </form>
        </div>
      ) : (
        <>
          {passwordEnabled && (
            <form action={passwordLogin} className="space-y-5" noValidate>
              <input type="hidden" name="dalej" value={next} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Adres e-mail</Label>
                <Input id="email" name="email" type="email" autoComplete="email" className="max-w-md" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="haslo">Hasło</Label>
                <Input id="haslo" name="haslo" type="password" autoComplete="current-password" className="max-w-md" />
              </div>
              <Button type="submit"><ArrowRightEndOnRectangleIcon aria-hidden />Zaloguj się</Button>
            </form>
          )}

          {testEnabled && (
            <section aria-labelledby="konto-testowe" className="space-y-4">
              <h2 id="konto-testowe" className="text-2xl font-bold">Konto testowe</h2>
              <Alert title="Tylko do testów">
                <p>Wybierz rolę jednym przyciskiem. To zastępuje prawdziwe konta, dopóki nie podłączymy logowania ROPS.</p>
              </Alert>
              <form action={testLogin} className="flex flex-col gap-3 sm:flex-row">
                <input type="hidden" name="dalej" value={next} />
                <Button type="submit" name="rola" value="admin" variant={passwordEnabled ? "outline" : "default"}>
                  <ArrowRightEndOnRectangleIcon aria-hidden />Wejdź jako administrator ROPS
                </Button>
                <Button type="submit" name="rola" value="mieszkaniec" variant="outline">
                  <ArrowRightEndOnRectangleIcon aria-hidden />Wejdź jako mieszkaniec
                </Button>
              </form>
              <FieldHint>Konto mieszkańca pozwala sprawdzić, że panel administratora jest dla niego niedostępny.</FieldHint>
            </section>
          )}

          {!testEnabled && !passwordEnabled && (
            <Alert title="Logowanie jest wyłączone">
              <p>Na tym serwerze nie skonfigurowano jeszcze logowania.</p>
            </Alert>
          )}
        </>
      )}
    </section>
  );
}
