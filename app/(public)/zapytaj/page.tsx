import Link from "next/link";
import { NoDatabase } from "@/components/layout/no-database";
import { MyNeeds } from "@/components/rozmowa/my-needs";
import { PrivateLink } from "@/components/rozmowa/private-link";
import { Alert } from "@/components/ui/alert";
import { rememberedKey } from "@/lib/need-access";
import { STATUS_CODE } from "@/lib/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { canOpen, expertName, needThread, rememberedThreads, type MyNeed, type NeedThread } from "@/lib/threads";
import { Conversation } from "./conversation";

export const metadata = { title: "Zapytaj eksperta" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

export default async function Page(props: PageProps<"/zapytaj">) {
  const params = await props.searchParams;
  const raw = typeof params.potrzeba === "string" ? params.potrzeba.trim().toUpperCase() : "";
  const askedExpert = typeof params.ekspert === "string" && UUID.test(params.ekspert) ? params.ekspert : undefined;
  const badLink = params.link === "nieaktualny";

  if (!isSupabaseConfigured()) return <NoDatabase />;

  let thread: NeedThread | null = null;
  let mine: MyNeed[] = [];
  let key: string | null = null;
  let chosenName: string | null = null;
  try {
    if (STATUS_CODE.test(raw)) {
      const found = await needThread({ code: raw });
      // Brak zgłoszenia i brak klucza wyglądają tak samo — po stronie nie da się sprawdzać, które kody istnieją.
      thread = found && (await canOpen(found)) ? found : null;
      key = thread ? await rememberedKey(thread.code) : null;
      // Ekspert z wyników dopasowania — tylko podpowiedź, dopóki ROPS nie przypisze kogoś w Panelu.
      if (thread && !thread.expert && askedExpert) chosenName = await expertName(askedExpert);
    }
    if (!thread) mine = await rememberedThreads();
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

  if (!thread || !key) return <MyConversations mine={mine} askedCode={raw} badLink={badLink} />;

  const expert = thread.expert?.name ?? chosenName;
  const idea = thread.kind === "pomysl";

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">
          {idea ? "Rozmowa o pomyśle" : "Rozmowa o zgłoszeniu"}{" "}
          <span className="font-mono tracking-wider whitespace-nowrap">{thread.code}</span>
        </h1>
        <p className="max-w-[68ch] text-lg">
          {thread.expert
            ? <>Twoim {idea ? "pomysłem" : "zgłoszeniem"} zajmuje się <strong>{thread.expert.name}</strong>. W rozmowie jest też pracownik ROPS.</>
            : chosenName
              ? <>Piszesz do: <strong>{chosenName}</strong>. Wiadomość najpierw zobaczy pracownik ROPS i zaprosi eksperta do rozmowy.</>
              : idea
                ? <>Tu odpisze Ci ROPS w sprawie pomysłu. Możesz też zapytać, np. o wsparcie mentora albo nabór.</>
                : <>Napisz, o co chcesz zapytać. Pracownik ROPS odpowie albo zaprosi do rozmowy eksperta.</>}
        </p>
        <p>
          <Link href={`/status/${thread.code}`} className={linkClass}>Zobacz status {idea ? "pomysłu" : "zgłoszenia"}</Link>
        </p>
      </div>

      <Conversation
        code={thread.code}
        expertId={chosenName ? askedExpert : undefined}
        expertName={expert}
        closed={thread.status === "zamkniete"}
        initial={{ threadId: thread.threadId, messages: thread.messages }}
      />

      <PrivateLink code={thread.code} accessKey={key} kind={thread.kind} />
    </section>
  );
}

/**
 * Bez kodu albo bez klucza: zgłoszenia zapamiętane w tej przeglądarce.
 * Sam kod nie otwiera rozmowy — da się go zgadnąć — więc odsyłamy do prywatnego linku albo strony statusu.
 */
function MyConversations({ mine, askedCode, badLink }: { mine: MyNeed[]; askedCode: string; badLink: boolean }) {
  return (
    <section className="max-w-3xl space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Zapytaj eksperta</h1>
        <p className="text-lg">
          Rozmowa z ekspertem i pracownikiem ROPS jest przypięta do Twojego zgłoszenia i widzisz ją tylko Ty.
        </p>
      </div>

      {badLink && (
        <Alert tone="error" title="Ten link nie działa">
          <p>Sprawdź, czy link jest skopiowany w całości. Jeśli tak, otwórz rozmowę na urządzeniu, z którego wysłano zgłoszenie.</p>
        </Alert>
      )}
      {askedCode && !badLink && (
        <Alert title="Nie możemy otworzyć tej rozmowy na tym urządzeniu">
          <p>
            Rozmowę o zgłoszeniu <span className="font-mono tracking-wider">{askedCode}</span> otworzysz na urządzeniu,
            z którego je wysłano, albo prywatnym linkiem. Sam kod pokazuje tylko{" "}
            {STATUS_CODE.test(askedCode)
              ? <Link href={`/status/${askedCode}`} className={linkClass}>status zgłoszenia</Link>
              : "status zgłoszenia"}
            .
          </p>
        </Alert>
      )}

      <MyNeeds mine={mine} primary="rozmowa" />

      <p>
        Nie masz jeszcze zgłoszenia? <Link href="/opisz" className={linkClass}>Opisz problem</Link> — rozmowa będzie
        czekać tutaj.
      </p>
    </section>
  );
}
