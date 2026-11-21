import Link from "next/link";
import { NoDatabase } from "@/components/layout/no-database";
import { EmailOptIn } from "@/components/rozmowa/email-opt-in";
import { ContactButton } from "@/components/pathways/contact-button";
import { PathwaysSection } from "@/components/pathways/pathways-section";
import { MyInitiatives } from "@/components/rozmowa/my-initiatives";
import { PrivateLink } from "@/components/rozmowa/private-link";
import { Alert } from "@/components/ui/alert";
import { maskedContactEmail } from "@/lib/author-contact";
import { rememberedKey } from "@/lib/initiatives/access";
import { initiativeContacts, type ContactRequest } from "@/lib/contacts";
import { initiativePathwaySource, pathwaysFor, type PathwaysView } from "@/lib/pathways";
import { partnerKindLabel } from "@/lib/taxonomy";
import { STATUS_CODE } from "@/lib/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { canOpen, initiativeThread, rememberedThreads, type InitiativeThread, type MyInitiative } from "@/lib/threads";
import { Conversation } from "./conversation";
import { org } from "@/lib/brand";

export const metadata = { title: "Rozmowy" };

// Autor ma wiedzieć przed pierwszą wiadomością, że najpierw odpisze AI, nie człowiek.
const AI_FIRST_LINE =
  `Na każdą wiadomość najpierw odpowiada asystent AI — tylko na podstawie bazy wiedzy i ze źródłami. Gdy nie zna pewnej odpowiedzi albo pytasz o swoją sprawę, przekazuje pytanie zespołowi ${org.short}. Człowiek widzi całą rozmowę.`;
const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

export default async function Page(props: PageProps<"/rozmowy">) {
  const params = await props.searchParams;
  const raw = typeof params.kod === "string" ? params.kod.trim().toUpperCase() : "";
  const badLink = params.link === "nieaktualny";

  if (!isSupabaseConfigured()) return <NoDatabase />;

  let thread: InitiativeThread | null = null;
  let mine: MyInitiative[] = [];
  let key: string | null = null;
  let contact: string | null = null;
  let pathways: PathwaysView | null = null;
  let contacts: ContactRequest[] = [];
  try {
    if (STATUS_CODE.test(raw)) {
      const found = await initiativeThread({ code: raw });
      // Brak zgłoszenia i brak klucza wyglądają tak samo — po stronie nie da się sprawdzać, które kody istnieją.
      thread = found && (await canOpen(found)) ? found : null;
      key = thread ? await rememberedKey(thread.code) : null;
      if (thread && key) contact = await maskedContactEmail(thread.code).catch(() => null);
      if (thread && key) {
        const id = thread.id;
        // Ścieżki, partnerzy i prośby o kontakt (6/10) — błąd nie zasłania rozmowy.
        [pathways, contacts] = await Promise.all([
          initiativePathwaySource(id).then((src) => (src ? pathwaysFor(src) : null))
            .catch((e): PathwaysView | null => { console.error("[rozmowy] ścieżki:", e); return null; }),
          initiativeContacts(id).catch((e): ContactRequest[] => { console.error("[rozmowy] kontakty:", e); return []; }),
        ]);
      }
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


  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">
          Rozmowa o inicjatywie <span className="font-mono tracking-wider whitespace-nowrap">{thread.code}</span>
        </h1>
        <p className="max-w-[68ch] text-lg">
          Napisz, o co chcesz zapytać — np. o wsparcie, program albo kolejny krok dla inicjatywy. Zespół {org.short} odpowie.
        </p>
        <p className="max-w-[68ch]">{AI_FIRST_LINE}</p>
        <p><Link href={`/status/${thread.code}`} className={linkClass}>Zobacz status zgłoszenia</Link></p>
      </div>

      <ContactNotice contacts={contacts} />

      <Conversation
        code={thread.code}
        closed={thread.status === "archived"}
        initial={{ threadId: thread.threadId, messages: thread.messages, waiting: thread.waiting }}
      />

      <OtherContacts code={thread.code} contacts={contacts} shown={new Set(pathways?.partners.map((m) => m.partner.id) ?? [])} />

      {pathways && (
        <div id="kontakty" className="space-y-12 scroll-mt-24">
          <PathwaysSection
            view={pathways}
            audience="author"
            size="panel"
            contactNote={
              <p>
                „Poproś o kontakt” to Twoja zgoda. Zespół {org.short} zapyta partnera, a gdy też się zgodzi, przedstawi was sobie w tej rozmowie.
                Partner nie zobaczy zgłoszenia ani Twoich danych bez Twojej zgody.
              </p>
            }
            partnerAction={(m) => {
              const c = contacts.find((x) => x.partnerId === m.partner.id);
              return <ContactButton code={thread.code} partnerId={m.partner.id} partnerName={m.partner.name} pathway={m.pathway} existing={c} />;
            }}
          />
        </div>
      )}

      <PrivateLink code={thread.code} accessKey={key} />
      <EmailOptIn code={thread.code} accessKey={key} current={contact} />
    </section>
  );
}

/** Propozycje kontaktu od zespołu, na które twórca jeszcze nie odpowiedział — widać je od razu pod nagłówkiem. */
function ContactNotice({ contacts }: { contacts: ContactRequest[] }) {
  const proposals = contacts.filter((c) => c.status === "oczekuje" && !c.authorConsent);
  if (proposals.length === 0) return null;
  return (
    <Alert title={`Zespół ${org.short} proponuje kontakt z partnerem`}>
      <p>{proposals.map((c) => c.partnerName).join(", ")}. Bez Twojej zgody partner nie zobaczy zgłoszenia.</p>
      <p><a href="#kontakty" className={linkClass}>Odpowiedz przy partnerze</a></p>
    </Alert>
  );
}

/** Prośby o partnerów, których nie ma już w dopasowaniu (np. po zmianie karty) — żeby nie zniknęły z widoku. */
function OtherContacts({ code, contacts, shown }: { code: string; contacts: ContactRequest[]; shown: Set<string> }) {
  const other = contacts.filter((c) => !shown.has(c.partnerId) && !(c.status === "odrzucone" && c.declinedBy === "author"));
  if (other.length === 0) return null;
  return (
    <section aria-labelledby="inne-kontakty" className="max-w-[68ch] space-y-3">
      <h2 id="inne-kontakty" className="text-2xl font-bold">Prośby o kontakt</h2>
      <ul className="border-t">
        {other.map((c) => (
          <li key={c.id} className="space-y-2 border-b py-4">
            <p><span className="font-bold">{c.partnerName}</span>{c.partnerKind && <span className="text-muted-foreground"> · {partnerKindLabel(c.partnerKind)}</span>}</p>
            <ContactButton code={code} partnerId={c.partnerId} partnerName={c.partnerName} pathway={c.pathway ?? undefined} existing={c} />
          </li>
        ))}
      </ul>
    </section>
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
          Rozmowa z zespołem {org.short} jest przypięta do Twojego zgłoszenia i widzisz ją tylko Ty.
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
