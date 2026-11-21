import Link from "next/link";
import { NoDatabase } from "@/components/layout/no-database";
import { EmailOptIn } from "@/components/rozmowa/email-opt-in";
import { MyInitiatives } from "@/components/rozmowa/my-initiatives";
import { PrivateLink } from "@/components/rozmowa/private-link";
import { Alert } from "@/components/ui/alert";
import { maskedContactEmail } from "@/lib/author-contact";
import { rememberedKey } from "@/lib/initiatives/access";
import { initiativePartnerships, type Partnership } from "@/lib/partnerships";
import { plural } from "@/lib/pl";
import { STATUS_CODE } from "@/lib/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { canOpen, initiativeThread, mentorName, rememberedThreads, type InitiativeThread, type MyInitiative } from "@/lib/threads";
import { Conversation } from "./conversation";
import { org } from "@/lib/brand";

export const metadata = { title: "Rozmowy" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Autor ma wiedzieć przed pierwszą wiadomością, że najpierw odpisze AI, nie człowiek.
const AI_FIRST_LINE =
  `Na każdą wiadomość najpierw odpowiada asystent AI — tylko na podstawie bazy wiedzy i ze źródłami. Gdy nie zna pewnej odpowiedzi albo pytasz o swoją sprawę, przekazuje pytanie zespołowi ${org.short}. Człowiek widzi całą rozmowę.`;
const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

export default async function Page(props: PageProps<"/rozmowy">) {
  const params = await props.searchParams;
  const raw = typeof params.kod === "string" ? params.kod.trim().toUpperCase() : "";
  const askedMentor = typeof params.mentor === "string" && UUID.test(params.mentor) ? params.mentor : undefined;
  const badLink = params.link === "nieaktualny";

  if (!isSupabaseConfigured()) return <NoDatabase />;

  let thread: InitiativeThread | null = null;
  let mine: MyInitiative[] = [];
  let key: string | null = null;
  let contact: string | null = null;
  let chosenName: string | null = null;
  let partnerships: Partnership[] = [];
  try {
    if (STATUS_CODE.test(raw)) {
      const found = await initiativeThread({ code: raw });
      // Brak zgłoszenia i brak klucza wyglądają tak samo — po stronie nie da się sprawdzać, które kody istnieją.
      thread = found && (await canOpen(found)) ? found : null;
      key = thread ? await rememberedKey(thread.code) : null;
      if (thread && key) contact = await maskedContactEmail(thread.code).catch(() => null);
      // Mentor z wyników — tylko podpowiedź, dopóki zespół nie przypisze kogoś w Panelu.
      if (thread && !thread.mentor && askedMentor) chosenName = await mentorName(askedMentor);
      if (thread && key) partnerships = await initiativePartnerships(thread.id).catch((e) => { console.error("[rozmowy] partnerstwa:", e); return []; });
    }
    if (!thread) mine = await rememberedThreads();
  } catch (e) {
    console.error("[rozmowy]", e);
    return (
      <section className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Rozmowy</h1>
        <Alert tone="error" title="Nie udało się wczytać rozmowy">
          <p>Rozmowy są chwilowo niedostępne. Spróbuj ponownie za kilka minut.</p>
        </Alert>
      </section>
    );
  }

  if (!thread || !key) return <MyConversations mine={mine} askedCode={raw} badLink={badLink} />;

  const mentor = thread.mentor?.name ?? chosenName;

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">
          Rozmowa o inicjatywie <span className="font-mono tracking-wider whitespace-nowrap">{thread.code}</span>
        </h1>
        <p className="max-w-[68ch] text-lg">
          {thread.mentor
            ? <>Twoją inicjatywą zajmuje się <strong>{thread.mentor.name}</strong>. W rozmowie jest też zespół {org.short}.</>
            : chosenName
              ? <>Piszesz do: <strong>{chosenName}</strong>. Wiadomość najpierw zobaczy zespół {org.short} i zaprosi mentora do rozmowy.</>
              : <>Napisz, o co chcesz zapytać — np. o wsparcie, program albo to, jak przenieść inicjatywę dalej. Zespół {org.short} odpowie albo zaprosi mentora.</>}
        </p>
        <p className="max-w-[68ch]">{AI_FIRST_LINE}</p>
        <p><Link href={`/status/${thread.code}`} className={linkClass}>Zobacz status zgłoszenia</Link></p>
      </div>

      <PartnershipNotice code={thread.code} partnerships={partnerships} />

      <Conversation
        code={thread.code}
        mentorId={chosenName ? askedMentor : undefined}
        mentorName={mentor}
        closed={thread.status === "archived"}
        initial={{ threadId: thread.threadId, messages: thread.messages, waiting: thread.waiting }}
      />

      <PrivateLink code={thread.code} accessKey={key} />
      <EmailOptIn code={thread.code} accessKey={key} current={contact} />
    </section>
  );
}

/** Zaproszenia do partnerstwa i rozmowy, w których jest ta inicjatywa — zaproszony dowiaduje się o nich tutaj. */
function PartnershipNotice({ code, partnerships }: { code: string; partnerships: Partnership[] }) {
  const href = `/partnerstwo?kod=${code}`;
  const invitations = partnerships.filter((p) => p.myStatus === "zaproszone");
  if (invitations.length > 0) {
    const first = invitations[0];
    return (
      <Alert title={`${first.initiator}: autor podobnej inicjatywy chce porozmawiać`}>
        {invitations.length > 1 && <p>Masz {invitations.length} {plural(invitations.length, "zaproszenie", "zaproszenia", "zaproszeń")} do partnerstwa.</p>}
        <p>Bez Twojej zgody nikt nie zobaczy Twojego zgłoszenia.</p>
        <p><Link href={href} className={linkClass}>Zobacz zaproszenie</Link></p>
      </Alert>
    );
  }
  if (!partnerships.some((p) => p.myStatus === "przyjete")) return null;
  return (
    <p>
      Rozmawiasz też z autorami podobnych inicjatyw. <Link href={href} className={linkClass}>Partnerstwo</Link>
    </p>
  );
}

/**
 * Bez kodu albo bez klucza: zgłoszenia zapamiętane w tej przeglądarce.
 * Sam kod nie otwiera rozmowy — da się go zgadnąć — więc odsyłamy do prywatnego linku albo strony statusu.
 */
function MyConversations({ mine, askedCode, badLink }: { mine: MyInitiative[]; askedCode: string; badLink: boolean }) {
  return (
    <section className="max-w-3xl space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Rozmowy</h1>
        <p className="text-lg">
          Rozmowa z zespołem {org.short} i mentorem jest przypięta do Twojego zgłoszenia i widzisz ją tylko Ty.
        </p>
        <p>{AI_FIRST_LINE}</p>
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

      <MyInitiatives mine={mine} primary="rozmowa" />

      <p>
        Zgłoszenie wysłano z innego urządzenia? Otwórz prywatny link pokazany po wysłaniu — rozmowa pojawi się tutaj.
      </p>
      <p>
        Nie masz jeszcze zgłoszenia? <Link href="/zglos" className={linkClass}>Zgłoś inicjatywę</Link> albo{" "}
        <Link href="/wskaz" className={linkClass}>wskaż cudzą</Link> — rozmowa będzie czekać tutaj.
      </p>
    </section>
  );
}
