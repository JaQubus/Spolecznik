import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/auth";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { LoginForm } from "./login-form";

export const metadata = { title: "Logowanie" };

const ROLE_LABELS: Record<string, string> = {
  mieszkaniec: "mieszkaniec",
  organizacja: "organizacja",
  jst: "samorząd (JST)",
  ekspert: "ekspert",
  admin: "administrator ROPS",
};

export default async function Page(props: PageProps<"/logowanie">) {
  const params = await props.searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const linkError = params.blad === "link";

  if (!isSupabaseConfigured()) {
    return (
      <section className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Logowanie</h1>
        <Alert title="Logowanie nie jest jeszcze skonfigurowane">
          <p>Brakuje adresu albo klucza publicznego Supabase w pliku .env.local.</p>
        </Alert>
      </section>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    return (
      <section className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Jesteś zalogowany</h1>
        <p className="text-lg">
          Konto: <strong>{user.email}</strong>
          {profile?.role && <>, rola: <strong>{ROLE_LABELS[profile.role] ?? profile.role}</strong></>}.
        </p>
        {profile?.role === "admin" && (
          <p>
            <Link href={next} className="text-lg font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
              Przejdź do Panelu
            </Link>
          </p>
        )}
        <form action={signOut}>
          <Button type="submit" variant="outline">Wyloguj się</Button>
        </form>
      </section>
    );
  }

  return (
    <section className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Logowanie</h1>
      <p className="text-lg">
        Konto jest dla samorządów, ekspertów i pracowników ROPS. Żeby zgłosić problem albo sprawdzić status,
        nie musisz się logować.
      </p>
      {linkError && (
        <Alert tone="error" title="Link do logowania nie zadziałał">
          <p>Mógł wygasnąć albo został już użyty. Wpisz adres e-mail, a wyślemy nowy.</p>
        </Alert>
      )}
      <LoginForm next={next} />
    </section>
  );
}
