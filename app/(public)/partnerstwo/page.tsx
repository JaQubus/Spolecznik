import { UsersIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { NoDatabase } from "@/components/layout/no-database";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { needPartnerships, partnershipMessages, partnershipPreview, type Partnership } from "@/lib/partnerships";
import { formatDate, plural } from "@/lib/pl";
import { STATUS_CODE } from "@/lib/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { canOpen, needThread } from "@/lib/threads";
import { invite, respond } from "./actions";
import { PartnershipConversation } from "./partnership-conversation";

export const metadata = { title: "Partnerstwo gmin" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} i ${names.at(-1)}` : names[0] ?? "");

/**
 * Partnerstwo gmin z podobnym problemem (README §6, Moduł V). Wszystko w imieniu jednego zgłoszenia,
 * więc jak w rozmowie: kod SPL-… i klucz z tej przeglądarki. Zaproszony widzi wątek dopiero po zgodzie.
 */
export default async function Page(props: PageProps<"/partnerstwo">) {
  const params = await props.searchParams;
  const code = typeof params.potrzeba === "string" ? params.potrzeba.trim().toUpperCase() : "";
  const threadId = typeof params.watek === "string" && UUID.test(params.watek) ? params.watek : null;
  const sent = typeof params.wyslano === "string" ? Number(params.wyslano) : null;

  if (!isSupabaseConfigured()) return <NoDatabase />;

  const need = STATUS_CODE.test(code) ? await needThread({ code }) : null;
  if (need?.kind !== "potrzeba" || !(await canOpen(need))) return <Locked code={code} />;

  const partnerships = await needPartnerships(need.id);
  const open = threadId ? partnerships.find((p) => p.threadId === threadId && p.myStatus === "przyjete") : undefined;

  if (open) {
    const messages = await partnershipMessages(open.threadId, need.id);
    return <ThreadView code={code} partnership={open} messages={messages} sent={sent} joined={params.dolaczono === "1"} />;
  }

  const invitations = partnerships.filter((p) => p.myStatus === "zaproszone");
  const joined = partnerships.filter((p) => p.myStatus === "przyjete");
  const own = partnerships.some((p) => p.isInitiator);
  const found = own ? null : await partnershipPreview(code);
  // Kto już rozmawia z podobnymi gminami, nie potrzebuje komunikatu „nie znaleźliśmy innych gmin”.
  const preview = found && (found.gminy.length > 0 || partnerships.length === 0) ? found : null;
  // Jeden zielony przycisk na widok: zaproszenie innych gmin, a gdy go nie ma — zgoda na pierwsze zaproszenie.
  const canInvite = !!preview && preview.gminy.length > 0;

  return (
    <section className="max-w-3xl space-y-10">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Partnerstwo gmin</h1>
        <p className="text-lg">
          Gminy z podobnym problemem mogą porozmawiać we wspólnej rozmowie: wymienić się doświadczeniem, razem
          wystąpić o pieniądze albo wdrożyć to samo rozwiązanie. Rozmowę prowadzi pracownik ROPS.
        </p>
        <p>
          Zgłoszenie <span className="font-mono font-bold tracking-wider">{code}</span>.{" "}
          <Link href={`/zapytaj?kod=${code}`} className={linkClass}>Wróć do rozmowy z ROPS</Link>
        </p>
      </div>

      {params.odrzucono === "1" && (
        <Alert title="Odrzucono zaproszenie">
          <p>Nie dołączysz do tej rozmowy, a inne gminy nie dowiedzą się o Twoim zgłoszeniu.</p>
        </Alert>
      )}

      {invitations.length > 0 && (
        <section aria-labelledby="zaproszenia" className="space-y-3">
          <h2 id="zaproszenia" className="text-2xl font-bold">Zaproszenia do rozmowy</h2>
          <p>
            Jeśli dołączysz, inne gminy w rozmowie zobaczą nazwę Twojej gminy i to, co napiszesz. Treści Twojego
            zgłoszenia nie zobaczą. Jeśli odmówisz, nikt się o nim nie dowie.
          </p>
          <ul className="border-t">
            {invitations.map((p, i) => (
              <li key={p.threadId} className="space-y-3 border-b py-6">
                <p className="text-xl font-bold">{p.initiator} chce porozmawiać o podobnym problemie</p>
                {p.summary && <p className="max-w-[68ch]"><strong>Ich problem:</strong> {p.summary}</p>}
                <p className="text-base text-muted-foreground">Zaproszenie z {formatDate(p.createdAt)}</p>
                <form action={respond} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="code" value={code} />
                  <input type="hidden" name="threadId" value={p.threadId} />
                  <Button
                    type="submit"
                    name="answer"
                    value="tak"
                    variant={!canInvite && i === 0 ? "default" : "outline"}
                    className="w-full sm:w-auto"
                    aria-label={`Dołącz do rozmowy: zaproszenie od ${p.initiator}`}
                  >
                    Dołącz do rozmowy
                  </Button>
                  <Button type="submit" name="answer" value="nie" variant="link" aria-label={`Nie, dziękuję: zaproszenie od ${p.initiator}`}>
                    Nie, dziękuję
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {joined.length > 0 && (
        <section aria-labelledby="partnerstwa" className="space-y-3">
          <h2 id="partnerstwa" className="text-2xl font-bold">Twoje partnerstwa</h2>
          <ul className="border-t">
            {joined.map((p) => (
              <li key={p.threadId} className="flex flex-wrap items-center justify-between gap-3 border-b py-4">
                <div className="min-w-0 flex-1 basis-64 space-y-1">
                  <p className="font-bold">{p.isInitiator ? "Twoje zaproszenie" : `Zaprasza: ${p.initiator}`}</p>
                  <p className="text-muted-foreground">W rozmowie: {list(p.joined)} i ROPS</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/partnerstwo?potrzeba=${code}&watek=${p.threadId}`} aria-label={`Otwórz rozmowę: ${p.isInitiator ? "Twoje zaproszenie" : p.initiator}`}>
                    Otwórz rozmowę
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview && (
        <section aria-labelledby="zapros" className="space-y-4">
          <h2 id="zapros" className="flex items-center gap-2 text-2xl font-bold">
            <UsersIcon aria-hidden className="size-6 shrink-0" />
            Zaproś gminy z podobnym problemem
          </h2>
          {preview.gminy.length === 0 ? (
            <p className="text-muted-foreground">
              Nie znaleźliśmy innych gmin z podobnym problemem. Kiedy ktoś zgłosi coś podobnego, wróć tutaj albo
              zapytaj ROPS w rozmowie o zgłoszeniu.
            </p>
          ) : (
            <>
              <p>
                Zaproszenie dostanie {preview.gminy.length} {plural(preview.gminy.length, "gmina", "gminy", "gmin")}:{" "}
                {list(preview.gminy)}.
              </p>
              <div className="space-y-2 rounded-[16px] bg-secondary px-5 py-4">
                <p className="font-bold">Co zobaczą zaproszeni</p>
                <p>„{preview.gmina} chce porozmawiać o podobnym problemie”</p>
                {preview.summary && <p className="max-w-[68ch]"><strong>Wasz problem:</strong> {preview.summary}</p>}
              </div>
              <ul className="list-disc space-y-1 pl-6">
                <li>Gminy zobaczą rozmowę dopiero, gdy się zgodzą. Do tego czasu nie poznasz ich zgłoszeń.</li>
                <li>Pełnej treści Twojego zgłoszenia nikt poza ROPS nie zobaczy.</li>
                <li>W rozmowie zawsze jest pracownik ROPS, który ją prowadzi.</li>
              </ul>
              <form action={invite}>
                <input type="hidden" name="code" value={code} />
                <Button type="submit" className="w-full sm:w-auto">Zaproś gminy do rozmowy</Button>
              </form>
            </>
          )}
        </section>
      )}
    </section>
  );
}

function ThreadView({
  code,
  partnership: p,
  messages,
  sent,
  joined,
}: {
  code: string;
  partnership: Partnership;
  messages: Awaited<ReturnType<typeof partnershipMessages>>;
  sent: number | null;
  joined: boolean;
}) {
  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Partnerstwo gmin</h1>
        {sent != null && Number.isFinite(sent) && (
          <Alert title="Wysłano zaproszenia">
            <p>
              {sent > 0
                ? `Zaprosiliśmy ${sent} ${plural(sent, "zgłoszenie", "zgłoszenia", "zgłoszeń")} z innych gmin. Gminy pojawią się w rozmowie, kiedy przyjmą zaproszenie.`
                : "Zaproszenia zostały wysłane wcześniej. Gminy pojawią się w rozmowie, kiedy je przyjmą."}
            </p>
          </Alert>
        )}
        {joined && (
          <Alert title="Dołączono do rozmowy">
            <p>Inne gminy widzą teraz nazwę Twojej gminy i to, co napiszesz w tej rozmowie.</p>
          </Alert>
        )}
        <p className="max-w-[68ch] text-lg">
          {p.isInitiator ? "Twoje zaproszenie." : `Zaprasza: ${p.initiator}.`}
          {p.summary && <> Problem: {p.summary}</>}
        </p>
        <p><strong>W rozmowie:</strong> {list(p.joined)} oraz pracownik ROPS (prowadzi rozmowę).</p>
        {p.waiting > 0 && (
          <p className="text-muted-foreground">
            Na odpowiedź czeka jeszcze {p.waiting} {plural(p.waiting, "zaproszenie", "zaproszenia", "zaproszeń")}.
          </p>
        )}
        <p>
          <Link href={`/partnerstwo?potrzeba=${code}`} className={linkClass}>Wszystkie partnerstwa i zaproszenia</Link>
          {" · "}
          <Link href={`/zapytaj?kod=${code}`} className={linkClass}>Rozmowa z ROPS o zgłoszeniu</Link>
        </p>
      </div>

      <PartnershipConversation code={code} threadId={p.threadId} initial={messages} />
    </section>
  );
}

/** Bez klucza w tej przeglądarce nie da się działać w imieniu zgłoszenia — jak w „Zapytaj eksperta”. */
function Locked({ code }: { code: string }) {
  return (
    <section className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Partnerstwo gmin</h1>
      <Alert title="Nie możemy otworzyć partnerstwa na tym urządzeniu">
        <p>
          Partnerstwo otworzysz na urządzeniu, z którego wysłano zgłoszenie{STATUS_CODE.test(code) ? <> <span className="font-mono tracking-wider">{code}</span></> : null},
          albo prywatnym linkiem do rozmowy.
        </p>
      </Alert>
      <p>
        <Link href="/zapytaj" className={linkClass}>Twoje zgłoszenia na tym urządzeniu</Link>
      </p>
    </section>
  );
}
