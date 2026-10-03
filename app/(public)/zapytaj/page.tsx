import Link from "next/link";
import { NoDatabase } from "@/components/layout/no-database";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS_CODE } from "@/lib/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { expertName, needThread, type NeedThread } from "@/lib/threads";
import { Conversation } from "./conversation";

export const metadata = { title: "Zapytaj eksperta" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

export default async function Page(props: PageProps<"/zapytaj">) {
  const params = await props.searchParams;
  const raw = typeof params.potrzeba === "string" ? params.potrzeba.trim().toUpperCase() : "";
  const askedExpert = typeof params.ekspert === "string" && UUID.test(params.ekspert) ? params.ekspert : undefined;

  if (!STATUS_CODE.test(raw)) return <EnterCode invalid={raw.length > 0} />;
  if (!isSupabaseConfigured()) return <NoDatabase />;

  let thread: NeedThread | null = null;
  let chosenName: string | null = null;
  try {
    thread = await needThread({ code: raw });
    // Ekspert z wyników dopasowania — tylko podpowiedź, dopóki ROPS nie przypisze kogoś w Panelu.
    if (thread && !thread.expert && askedExpert) chosenName = await expertName(askedExpert);
  } catch (e) {
    console.error("[zapytaj]", e);
    return (
      <section className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Zapytaj eksperta</h1>
        <Alert tone="error" title="Nie udało się wczytać rozmowy">
          <p>Rozmowy są chwilowo niedostępne. Spróbuj ponownie za kilka minut.</p>
        </Alert>
      </section>
    );
  }

  if (!thread) {
    return (
      <section className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Nie znaleźliśmy tego zgłoszenia</h1>
        <p className="text-lg">
          Nie ma zgłoszenia o kodzie <strong className="font-mono tracking-wider">{raw}</strong>. Sprawdź, czy kod jest
          przepisany dokładnie.
        </p>
        <Button asChild variant="outline"><Link href="/zapytaj">Wpisz kod jeszcze raz</Link></Button>
      </section>
    );
  }

  const expert = thread.expert?.name ?? chosenName;

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">
          Rozmowa o zgłoszeniu <span className="font-mono tracking-wider whitespace-nowrap">{thread.code}</span>
        </h1>
        <p className="max-w-[68ch] text-lg">
          {thread.expert
            ? <>Twoim zgłoszeniem zajmuje się <strong>{thread.expert.name}</strong>. W rozmowie jest też pracownik ROPS.</>
            : chosenName
              ? <>Piszesz do: <strong>{chosenName}</strong>. Wiadomość najpierw zobaczy pracownik ROPS i zaprosi eksperta do rozmowy.</>
              : <>Napisz, o co chcesz zapytać. Pracownik ROPS odpowie albo zaprosi do rozmowy eksperta.</>}
        </p>
        <p>
          <Link href={`/status/${thread.code}`} className={linkClass}>Zobacz status zgłoszenia</Link>
        </p>
      </div>

      <Conversation
        code={thread.code}
        expertId={chosenName ? askedExpert : undefined}
        expertName={expert}
        closed={thread.status === "zamkniete"}
        initial={{ threadId: thread.threadId, messages: thread.messages }}
      />
    </section>
  );
}

/** Rozmowa jest przypięta do zgłoszenia, więc najpierw kod — bez zakładania konta. */
function EnterCode({ invalid }: { invalid: boolean }) {
  return (
    <section className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Zapytaj eksperta</h1>
      <p className="text-lg">
        Rozmowa z ekspertem i pracownikiem ROPS jest przypięta do Twojego zgłoszenia. Wpisz jego kod — ten sam, którym
        sprawdzasz status.
      </p>
      <form action="/zapytaj" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="potrzeba">Kod zgłoszenia</Label>
          <FieldHint id="potrzeba-pomoc">Ma postać SPL- i cztery znaki, np. SPL-4K7Q.</FieldHint>
          <FieldError id="potrzeba-blad">
            {invalid && "To nie wygląda na kod zgłoszenia. Wpisz SPL- i cztery znaki, np. SPL-4K7Q."}
          </FieldError>
          <Input
            id="potrzeba"
            name="potrzeba"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={invalid}
            aria-describedby={invalid ? "potrzeba-pomoc potrzeba-blad" : "potrzeba-pomoc"}
            className="max-w-xs font-mono tracking-wider"
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto">Przejdź do rozmowy</Button>
      </form>
      <p>
        Nie masz kodu? <Link href="/opisz" className={linkClass}>Opisz problem</Link> — kod dostaniesz od razu po
        wysłaniu.
      </p>
    </section>
  );
}
