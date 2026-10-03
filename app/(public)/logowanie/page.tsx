import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getUser, safeNext } from "@/lib/auth";
import { signOut } from "./actions";
import { LoginForm } from "./login-form";

export const metadata = { title: "Logowanie" };

const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

export default async function Page(props: PageProps<"/logowanie">) {
  const { next, blad } = await props.searchParams;
  const nextPath = safeNext(typeof next === "string" ? next : null);
  const user = await getUser();

  return (
    <section className="max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">Logowanie</h1>
      {user ? (
        <>
          <p>Jesteś zalogowany jako <strong>{user.email}</strong>.</p>
          <p><Link href={nextPath} className={linkClass}>Przejdź dalej</Link></p>
          <form action={signOut}>
            <Button type="submit" variant="outline">Wyloguj się</Button>
          </form>
        </>
      ) : (
        <>
          <p className="max-w-[68ch]">
            Logowanie jest dla pracowników ROPS, gmin i ekspertów. Żeby opisać problem albo sprawdzić status zgłoszenia,
            nie musisz się logować.
          </p>
          {blad === "link" && (
            <Alert tone="error" title="Link do logowania nie zadziałał">
              <p>Mógł wygasnąć albo został już użyty. Wpisz adres e-mail jeszcze raz, a wyślemy nowy.</p>
            </Alert>
          )}
          <LoginForm next={nextPath} />
        </>
      )}
    </section>
  );
}
