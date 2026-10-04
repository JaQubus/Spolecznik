import Link from "next/link";
import { formatTime } from "@/lib/thread-types";
import { FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PanelPartnership } from "@/lib/partnerships";
import { ActionForm, SubmitButton } from "./action-form";
import { removePartnershipMessage, replyInPartnership } from "./actions";
import { ThreadLive } from "./thread-live";

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

/** Partnerstwa gmin, w których jest zgłoszenie. ROPS prowadzi każde jako moderator: pisze i usuwa wiadomości gmin. */
export function PartnershipSection({ partnerships, needId }: { partnerships: PanelPartnership[]; needId: string }) {
  if (partnerships.length === 0) return null;
  return (
    <section aria-labelledby="partnerstwo" className="space-y-6">
      <h2 id="partnerstwo" className="text-2xl font-bold">Partnerstwo gmin</h2>
      <FieldHint>
        Prowadzisz tę rozmowę jako moderator. Zaproszone gminy widzą ją dopiero po zgodzie; gminy nie widzą
        nawzajem swoich zgłoszeń ani kodów — tylko nazwy gmin i wiadomości.
      </FieldHint>
      {partnerships.map((p) => <PartnershipPanel key={p.threadId} partnership={p} needId={needId} />)}
    </section>
  );
}

const PARTICIPANT_LABELS = { zaproszone: "zaproszona, bez odpowiedzi", przyjete: "w rozmowie", odrzucone: "odmówiła" } as const;

function PartnershipPanel({ partnership: p, needId }: { partnership: PanelPartnership; needId: string }) {
  const heading = `partnerstwo-${p.threadId}`;
  return (
    <section aria-labelledby={heading} className="space-y-4">
      <h3 id={heading} className="text-xl font-bold">
        {p.isInitiator ? "Zaproszenie od tego zgłoszenia" : "To zgłoszenie jest zaproszone"}
      </h3>
      <ThreadLive threadId={p.threadId} />
      {!p.isInitiator && (
        <p>
          <Link href={`/panel/zgloszenia/${p.initiatorNeedId}#partnerstwo`} className={`font-bold ${linkClass}`}>
            Zgłoszenie, które zaprasza
          </Link>
        </p>
      )}
      <ul className="border-t" aria-label="Uczestnicy">
        {p.participants.map((u) => (
          <li key={u.needId} className="flex flex-wrap gap-x-3 border-b py-3">
            {u.needId === needId ? (
              <span className="font-mono font-bold tracking-wider">{u.code}</span>
            ) : (
              <Link href={`/panel/zgloszenia/${u.needId}`} className={`font-mono font-bold tracking-wider ${linkClass}`}>{u.code}</Link>
            )}
            <span>{u.gmina}</span>
            <span className="text-muted-foreground">{u.isInitiator ? "zaprasza" : PARTICIPANT_LABELS[u.status]}</span>
          </li>
        ))}
      </ul>
      {p.messages.length === 0 ? (
        <p className="text-muted-foreground">Nikt jeszcze nie napisał. Możesz zacząć: przedstaw gminy sobie nawzajem i zaproponuj temat.</p>
      ) : (
        <div role="log" aria-label="Wiadomości w partnerstwie" className="max-w-3xl">
          <ol className="border-t">
            {p.messages.map((m) => (
              <li key={m.id} className={`space-y-2 border-b px-3 py-4 ${m.role === "autor" ? "" : "bg-secondary"}`}>
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <strong>{m.name}</strong>
                  <span className="text-base text-muted-foreground"><time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time></span>
                </p>
                <p className="max-w-[68ch] whitespace-pre-wrap break-words">{m.body}</p>
                {m.role === "autor" && (
                  <ActionForm action={removePartnershipMessage}>
                    <input type="hidden" name="threadId" value={p.threadId} />
                    <input type="hidden" name="messageId" value={m.id} />
                    <SubmitButton variant="link" size="sm" pendingText="Usuwanie…" aria-label={`Usuń wiadomość: ${m.name}`}>
                      Usuń wiadomość
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      <ActionForm action={replyInPartnership} className="max-w-2xl space-y-4">
        <input type="hidden" name="threadId" value={p.threadId} />
        <div className="space-y-2">
          <Label htmlFor={`partnerstwo-odp-${p.threadId}`}>Wiadomość do gmin</Label>
          <FieldHint id={`partnerstwo-pomoc-${p.threadId}`}>Podpiszemy ją „ROPS Kraków”. Przeczytają ją wszystkie gminy w rozmowie.</FieldHint>
          <Textarea
            id={`partnerstwo-odp-${p.threadId}`}
            name="body"
            required
            minLength={2}
            maxLength={2000}
            aria-describedby={`partnerstwo-pomoc-${p.threadId}`}
            className="min-h-24"
          />
        </div>
        <SubmitButton variant="outline" pendingText="Wysyłanie…">Wyślij do gmin</SubmitButton>
      </ActionForm>
    </section>
  );
}

